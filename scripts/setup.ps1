# One-time launch: GitHub sign-in -> public repo -> push -> Cloudflare secrets -> first pipeline run.
# Run from the project folder:  powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
# Secrets are typed into hidden prompts and sent straight to GitHub; they are never stored on disk.
$ErrorActionPreference = 'Stop'
$gh = 'C:\Program Files\GitHub CLI\gh.exe'
$repo = 'ai-agents-hub'
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "`n[1/5] GitHub sign-in" -ForegroundColor Cyan
& $gh auth status 2>$null
if ($LASTEXITCODE -ne 0) { & $gh auth login --hostname github.com --git-protocol https --web --scopes workflow }
& $gh auth setup-git
$user = & $gh api user -q .login
Write-Host "Signed in as $user"

Write-Host "`n[2/5] Create public repo $user/$repo" -ForegroundColor Cyan
& $gh repo view "$user/$repo" 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  & $gh repo create $repo --public --description 'Self-updating AI agents news and guides - aiagentnewsfree.com'
}
if (-not (git remote | Select-String -Quiet '^origin$')) { git remote add origin "https://github.com/$user/$repo.git" }

# Secrets go in before the first push, because every push to main deploys.
Write-Host "`n[3/5] Cloudflare secrets (input is hidden)" -ForegroundColor Cyan
Write-Host "First create the Pages project 'aiagentnewsfree' (Workers & Pages > Create > Pages > Direct Upload)."
Write-Host "Account ID: Workers & Pages overview. Token: My Profile > API Tokens > Custom Token with 'Cloudflare Pages: Edit' + 'Workers AI: Read'."
foreach ($name in 'CF_ACCOUNT_ID', 'CF_API_TOKEN') {
  $secure = Read-Host "Paste $name" -AsSecureString
  $plain = [System.Net.NetworkCredential]::new('', $secure).Password
  if (-not $plain) { throw "$name is empty" }
  $plain | & $gh secret set $name --repo "$user/$repo"
  $plain = $null
}

Write-Host "`nPushing code (this deploys the site shell)" -ForegroundColor Cyan
git branch -M main
git push -u origin main

Write-Host "`n[4/5] Start the first content run (writes guides + news, then deploys)" -ForegroundColor Cyan
& $gh workflow run auto.yml --repo "$user/$repo" --ref main
Start-Sleep -Seconds 5
& $gh run list --repo "$user/$repo" --limit 3

Write-Host "`n[5/5] Watch it (Ctrl+C to stop watching; the run continues)" -ForegroundColor Cyan
$id = & $gh run list --repo "$user/$repo" --workflow auto.yml --event workflow_dispatch --limit 1 --json databaseId -q '.[0].databaseId'
& $gh run watch $id --repo "$user/$repo" --exit-status
Write-Host "`nDone. Next: Cloudflare > Workers & Pages > aiagentnewsfree > Custom domains > add aiagentnewsfree.com" -ForegroundColor Green
