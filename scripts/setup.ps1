# One-time launch: GitHub sign-in -> public repo -> Cloudflare secrets -> push -> first pipeline run.
# Run:  powershell -ExecutionPolicy Bypass -File D:\ai-agents-hub\scripts\setup.ps1
# Secrets are typed into hidden prompts and sent straight to GitHub; they are never stored on disk.

# Windows PowerShell 5.1 treats any stderr from native tools as an error under 'Stop',
# so we use 'Continue' and check exit codes ourselves.
$ErrorActionPreference = 'Continue'
$gh = 'C:\Program Files\GitHub CLI\gh.exe'
$repo = 'ai-agents-hub'
Set-Location (Split-Path $PSScriptRoot -Parent)

function Fail($msg) { Write-Host "`nSTOPPED: $msg" -ForegroundColor Red; exit 1 }
function Ok($what) { if ($LASTEXITCODE -ne 0) { Fail "$what failed (exit $LASTEXITCODE)" } }

Write-Host "`n[1/5] GitHub sign-in" -ForegroundColor Cyan
& $gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "A one-time code will be shown and copied. Press Enter, paste it in the browser, click Authorize."
  & $gh auth login --hostname github.com --git-protocol https --web --scopes workflow
  Ok "GitHub sign-in"
}
& $gh auth setup-git; Ok "git credential setup"
$user = & $gh api user -q .login; Ok "reading your GitHub user"
Write-Host "Signed in as $user" -ForegroundColor Green

Write-Host "`n[2/5] Create public repo $user/$repo" -ForegroundColor Cyan
& $gh repo view "$user/$repo" *> $null
if ($LASTEXITCODE -ne 0) {
  & $gh repo create $repo --public --description 'Self-updating AI agents news and guides - aiagentnewsfree.com'
  Ok "creating the repo"
} else { Write-Host "Repo already exists" }
$remotes = git remote
if ($remotes -notcontains 'origin') { git remote add origin "https://github.com/$user/$repo.git"; Ok "adding the remote" }

# Secrets go in before the first push, because every push to main deploys.
Write-Host "`n[3/5] Cloudflare secrets (input is hidden)" -ForegroundColor Cyan
Write-Host "Needs: Pages project 'aiagentnewsfree' (Workers & Pages > Create > Pages > Direct Upload)."
Write-Host "Account ID: Workers & Pages overview (right side). Token: My Profile > API Tokens > Custom Token"
Write-Host "  with 'Account > Cloudflare Pages > Edit' and 'Account > Workers AI > Read'."
foreach ($name in 'CF_ACCOUNT_ID', 'CF_API_TOKEN') {
  $secure = Read-Host "Paste $name (or press Enter to skip for now)" -AsSecureString
  $plain = [System.Net.NetworkCredential]::new('', $secure).Password
  if (-not $plain) { Write-Host "Skipped $name - the deploy step will fail until it is added." -ForegroundColor Yellow; continue }
  $plain | & $gh secret set $name --repo "$user/$repo"
  $plain = $null
  Ok "saving $name"
}

Write-Host "`nPushing code" -ForegroundColor Cyan
git branch -M main
git push -u origin main; Ok "git push"

Write-Host "`n[4/5] Start the first content run (writes guides + news, then deploys)" -ForegroundColor Cyan
& $gh workflow run auto.yml --repo "$user/$repo" --ref main; Ok "starting the workflow"
Start-Sleep -Seconds 8
$id = & $gh run list --repo "$user/$repo" --workflow auto.yml --event workflow_dispatch --limit 1 --json databaseId -q '.[0].databaseId'

Write-Host "`n[5/5] Watching run $id (Ctrl+C stops watching; the run continues on GitHub)" -ForegroundColor Cyan
Write-Host "https://github.com/$user/$repo/actions"
& $gh run watch $id --repo "$user/$repo" --exit-status
if ($LASTEXITCODE -ne 0) { Fail "the pipeline run failed - open the Actions link above and check the red step" }
Write-Host "`nDone. Next: Cloudflare > Workers & Pages > aiagentnewsfree > Custom domains > add aiagentnewsfree.com" -ForegroundColor Green
