# Deploying the ops dashboard on Cloud Run with Google sign-in

Outcome: an HTTPS URL that shows a "Sign in with Google" page and only lets in
the e-mail addresses listed in `ALLOWED_EMAILS`. The dashboard reads the report
spreadsheets with a read-only service account and refreshes every 15 minutes.
Nothing in the container stores customer data.

All commands run in **Cloud Shell** (the terminal built into the Google Cloud
console), so nothing has to be installed on a laptop. Replace the values in
angle brackets.

## 1. Project and APIs

```bash
PROJECT=<gcp-project-id>
REGION=asia-southeast1
gcloud config set project $PROJECT
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com sheets.googleapis.com
```

## 2. Secrets: service account key and session secret

Upload the service account key (the JSON file downloaded from the console) to
Cloud Shell with the "Upload file" button, then:

```bash
gcloud secrets create wheyshop-sheets-key --data-file=./service-account.json
openssl rand -hex 32 | gcloud secrets create wheyshop-session-secret --data-file=-
rm service-account.json
```

Share every report spreadsheet (Viewer) with the `client_email` inside that key.

## 3. OAuth client for the sign-in button

Console → APIs & Services → Credentials → Create credentials → OAuth client ID,
type **Web application**. Leave the URIs empty for now; copy the client ID
(`....apps.googleusercontent.com`). If the consent screen is not configured yet,
the console asks for it first: user type External, app name WheyShop, your own
e-mail as support and developer contact, no scopes, publishing status Testing
with your e-mail as a test user.

## 4. Deploy

Shortcut: `scripts/deploy-cloud-run.sh` runs steps 1, 2 and 4 from the variables
`PROJECT`, `GOOGLE_CLIENT_ID`, `ALLOWED_EMAILS`, `OPS_SOURCES_JSON` and `KEY_FILE`
(first time only). The manual commands are kept below.

```bash
git clone https://github.com/<owner>/atomic-crm.git && cd atomic-crm
git checkout <branch>
cp Dockerfile.ops Dockerfile

OPS_SOURCES_JSON='[{"branch":"HN","line":"HCT","spreadsheetId":"<id of file HCT>"},{"branch":"HN","line":"HXT","spreadsheetId":"<id of file HXT>"}]'

gcloud run deploy wheyshop-ops --source . --region $REGION --allow-unauthenticated \
  --set-secrets=/secrets/sa.json=wheyshop-sheets-key:latest,SESSION_SECRET=wheyshop-session-secret:latest \
  --set-env-vars=^@^GOOGLE_APPLICATION_CREDENTIALS=/secrets/sa.json@GOOGLE_CLIENT_ID=<client id>@ALLOWED_EMAILS=<your e-mail>@OPS_SOURCES_JSON=$OPS_SOURCES_JSON \
  --min-instances=0 --max-instances=1 --memory=512Mi
```

`--allow-unauthenticated` only means Cloud Run itself does not block requests;
the app enforces the Google sign-in and the allow-list. `^@^` makes `@` the
separator between variables because the JSON contains commas.

The command prints the service URL (`https://wheyshop-ops-....run.app`).

## 5. Register the URL with the OAuth client

Console → Credentials → the OAuth client → add the service URL to
**Authorised JavaScript origins** and `<service URL>/auth/login` to
**Authorised redirect URIs** → Save. Wait a minute, then open the URL in a
private window: it must show the sign-in page, refuse an address outside
`ALLOWED_EMAILS`, and show "Đang nối Google Sheets" in the sidebar for yours.

## Day-to-day

- Add a viewer: redeploy with `--update-env-vars=ALLOWED_EMAILS=a@x.com,b@y.com`.
- Add a spreadsheet: redeploy with a new `OPS_SOURCES_JSON` (HCM, VINH, DN).
- Update the code: `git pull` then the same `gcloud run deploy` command.
- Rotate the key: `gcloud secrets versions add wheyshop-sheets-key --data-file=./new-key.json` and redeploy.
- Optional extra layer: Identity-Aware Proxy in front of the service
  (`gcloud beta run services update wheyshop-ops --iap`, then grant
  `roles/iap.httpsResourceAccessor`); the app login still applies.

## Local run of the production image

Build with `docker build -f Dockerfile.ops -t wheyshop-ops .`, then start the
image with port 8080 published, `OPS_SOURCES_JSON` and
`GOOGLE_APPLICATION_CREDENTIALS=/secrets/sa.json` as environment variables and
the key file mounted read-only at `/secrets/sa.json`.

Without `GOOGLE_CLIENT_ID` the server has no login and must stay on localhost.
