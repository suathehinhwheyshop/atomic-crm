#!/usr/bin/env bash
# Deploy the ops dashboard to Cloud Run in one go (run inside Cloud Shell).
#
# Required environment variables:
#   PROJECT            GCP project id (e.g. wheyshop-crm)
#   GOOGLE_CLIENT_ID   OAuth web client id (....apps.googleusercontent.com)
#   ALLOWED_EMAILS     comma-separated e-mails allowed to sign in
#   OPS_SOURCES_JSON   JSON list of { branch, line, spreadsheetId }
#   KEY_FILE           path to the service account key (only needed the first time)
# Optional: REGION (default asia-southeast1), SERVICE (default wheyshop-ops)
set -euo pipefail

REGION="${REGION:-asia-southeast1}"
SERVICE="${SERVICE:-wheyshop-ops}"
for name in PROJECT GOOGLE_CLIENT_ID ALLOWED_EMAILS OPS_SOURCES_JSON; do
  if [ -z "${!name:-}" ]; then
    echo "deploy: set $name first" >&2
    exit 1
  fi
done
node -e 'JSON.parse(process.argv[1])' "$OPS_SOURCES_JSON" || { echo "deploy: OPS_SOURCES_JSON is not valid JSON" >&2; exit 1; }

echo "== 1/4 project and APIs"
gcloud config set project "$PROJECT" >/dev/null
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com sheets.googleapis.com

echo "== 2/4 secrets"
if ! gcloud secrets describe wheyshop-sheets-key >/dev/null 2>&1; then
  [ -f "${KEY_FILE:-}" ] || { echo "deploy: KEY_FILE must point to the service account key json" >&2; exit 1; }
  gcloud secrets create wheyshop-sheets-key --data-file="$KEY_FILE"
  echo "   key stored in Secret Manager; you can delete $KEY_FILE from Cloud Shell now"
fi
if ! gcloud secrets describe wheyshop-session-secret >/dev/null 2>&1; then
  openssl rand -hex 32 | gcloud secrets create wheyshop-session-secret --data-file=-
fi
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
for secret in wheyshop-sheets-key wheyshop-session-secret; do
  gcloud secrets add-iam-policy-binding "$secret" --member="serviceAccount:$RUNTIME_SA" \
    --role="roles/secretmanager.secretAccessor" >/dev/null
done

echo "== 3/4 build and deploy (takes a few minutes)"
cp -f Dockerfile.ops Dockerfile
gcloud run deploy "$SERVICE" --source . --region "$REGION" --allow-unauthenticated \
  --set-secrets="/secrets/sa.json=wheyshop-sheets-key:latest,SESSION_SECRET=wheyshop-session-secret:latest" \
  --set-env-vars="^@^GOOGLE_APPLICATION_CREDENTIALS=/secrets/sa.json@GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}@ALLOWED_EMAILS=${ALLOWED_EMAILS}@OPS_SOURCES_JSON=${OPS_SOURCES_JSON}" \
  --min-instances=0 --max-instances=1 --memory=512Mi --quiet
rm -f Dockerfile

URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')
echo "== 4/4 done"
echo "Service URL: $URL"
echo "Now add to the OAuth client (APIs & Services > Credentials):"
echo "  Authorised JavaScript origins: $URL"
echo "  Authorised redirect URIs:      $URL/auth/login"
