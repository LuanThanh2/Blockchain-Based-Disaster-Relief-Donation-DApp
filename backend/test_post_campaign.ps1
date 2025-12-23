# Test script: POST a sample campaign to the local backend
# Usage: from repo root PowerShell: .\.venv\Scripts\Activate.ps1; .\backend\test_post_campaign.ps1

$payload = @{
    title = "Hỗ trợ vùng lũ"
    short_desc = "Quyên góp cứu trợ"
    description = "Chi tiết mục tiêu gây quỹ..."
    image_url = "https://example.com/img.png"
    target_amount = 1.5
    currency = "ETH"
    beneficiary = "0xAbc..."
    deadline = "2026-01-15T00:00:00Z"
} | ConvertTo-Json -Depth 5

# Ensure we send UTF-8 bytes (PowerShell strings are UTF-16LE by default when sent)
$utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)

$endpoints = @(
    "http://localhost:5050/api/v1/campaigns/debug/echo",
    "http://localhost:5050/api/v1/campaigns/"
)

foreach ($url in $endpoints) {
    Write-Host "Posting to ${url} (Invoke-RestMethod with UTF-8 body)"
    try {
        # Send raw UTF-8 bytes so the server receives correct encoding
        $resp = Invoke-RestMethod -Method Post -Uri $url -ContentType "application/json; charset=utf-8" -Body $utf8Bytes
        Write-Host "Success response from ${url}`n" ($resp | ConvertTo-Json -Depth 10)
    } catch {
        Write-Host "Request to ${url} failed:`n" $_.Exception.Message
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $body = $reader.ReadToEnd()
            Write-Host "Response body from ${url}`n" $body
        }
    }
    Write-Host "----`n"
}

# Also write payload.json encoded as UTF-8 (without BOM) so curl --data-binary works reliably
$payloadPath = Join-Path -Path (Get-Location) -ChildPath "payload.json"
Set-Content -Path $payloadPath -Value $payload -Encoding utf8
Write-Host "Wrote payload.json to $payloadPath (UTF-8)"

if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
    $curlUrl = "http://localhost:5050/api/v1/campaigns/debug/echo"
    Write-Host "Posting to $curlUrl using curl.exe --data-binary @payload.json"
    try {
        & curl.exe -X POST $curlUrl -H "Content-Type: application/json; charset=utf-8" --data-binary "@$payloadPath"
    } catch {
        Write-Host "curl.exe request failed: $_"
    }
} else {
    Write-Host "curl.exe not found; skipped curl test"
}
