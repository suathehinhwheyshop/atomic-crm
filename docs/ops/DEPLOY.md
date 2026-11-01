# Deploying the ops dashboard on Cloud Run behind Identity-Aware Proxy

Outcome: an HTTPS URL that asks for a Google login and only lets in the email
addresses on an allow-list. The dashboard reads the report spreadsheets with a
service account that has read-only access, refreshed every minute. Nothing in
the container holds customer data at rest.

Run the commands from the repository root on a machine with `gcloud` logged in.
Replace the values in angle brackets. Step numbers match the chat plan.

## 0. One-time project settings

```bash
PROJECT=<gcp-project-id>
REGION=asia-southeast1
gcloud config set project $PROJECT
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com \
  iap.googleapis.com sheets.googleapis.com
```

## 1. Service account key as a secret

The key file is the one already created in Google Cloud (the one the sheets are
shared with). It is uploaded once to Secret Manager and never committed.

```bash
gcloud secrets create wheyshop-sheets-key --data-file=./service-account.json
```

Share every report spreadsheet (Viewer) with the `client_email` of that key.

## 2. Spreadsheet list

`OPS_SOURCES_JSON` holds the list inline (same shape as `ops/sources.example.json`):

```bash
OPS_SOURCES_JSON='[{"branch":"HN","line":"HCT","spreadsheetId":"<id>"},{"branch":"HN","line":"HXT","spreadsheetId":"<id>"}]'
```

Add HCM (HCT, HXT), VINH (GOP) and DN (GOP) when those files are ready.

## 3. Build and deploy

```bash
gcloud run deploy wheyshop-ops \
  --source . \
  --region $REGION \
  --no-allow-unauthenticated \
  --set-secrets=/secrets/sa.json=wheyshop-sheets-key:latest \
  --set-env-vars=GOOGLE_APPLICATION_CREDENTIALS=/secrets/sa.json,OPS_SOURCES_JSON="$OPS_SOURCES_JSON" \
  --min-instances=0 --max-instances=2 --memory=512Mi
```

`--source .` uses `Dockerfile.ops` only if it is named `Dockerfile`; either copy it
(`cp Dockerfile.ops Dockerfile`) before deploying, or build the image yourself:

```bash
gcloud builds submit --tag $REGION-docker.pkg.dev/$PROJECT/ops/wheyshop-ops -f Dockerfile.ops .
gcloud run deploy wheyshop-ops --image $REGION-docker.pkg.dev/$PROJECT/ops/wheyshop-ops --region $REGION ... (same flags)
```

## 4. Google login with Identity-Aware Proxy

IAP puts a Google sign-in page in front of the service and checks the user
against an allow-list; the app itself needs no login code.

```bash
# Enable IAP on the Cloud Run service (the flag name may differ by gcloud
# version: check `gcloud beta run services update --help` for "iap").
gcloud beta run services update wheyshop-ops --region $REGION --iap

# Allow people in, one line per address (or a Google Group).
for EMAIL in owner@example.com accountant@example.com; do
  gcloud beta iap web add-iam-policy-binding \
    --resource-type=cloud-run --service=wheyshop-ops --region=$REGION \
    --member="user:$EMAIL" --role="roles/iap.httpsResourceAccessor"
done
```

Remove an address with `remove-iam-policy-binding`. The first time, IAP asks for
an OAuth consent screen (internal, organisation name "WheyShop"): accept the
console prompt or run `gcloud iap oauth-brands create`.

## 5. Check

```bash
gcloud run services describe wheyshop-ops --region $REGION --format='value(status.url)'
```

Open the URL in a private window: it must ask for a Google account, refuse an
address outside the list, and show "Đang nối Google Sheets" in the sidebar for an
allowed one. `/healthz` answers `ok` (through IAP as well).

## Updating

Redeploy with the same `gcloud run deploy` command after `git pull`. To change the
spreadsheet list, redeploy with a new `OPS_SOURCES_JSON`. To rotate the key:
`gcloud secrets versions add wheyshop-sheets-key --data-file=./new-key.json`.

## Local run of the production image

```bash
docker build -f Dockerfile.ops -t wheyshop-ops .
docker run --rm -p 8080:8080 -e OPS_SOURCES_JSON="$OPS_SOURCES_JSON" \
  -e GOOGLE_APPLICATION_CREDENTIALS=/secrets/sa.json \
  -v "$PWD/service-account.json:/secrets/sa.json:ro" wheyshop-ops
```
