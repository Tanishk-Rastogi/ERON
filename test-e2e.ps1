$ErrorActionPreference = 'Stop'

Write-Host "1. LOGIN & GET JWT (Origin Hosp A)"
$loginOriginRes = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/auth/login' -Method Post -ContentType 'application/json' -Body '{"hospitalName": "District Hospital Central", "hospitalCode": "HOSP-PASS"}'
$tokenOrigin = $loginOriginRes.token
$hospA = $loginOriginRes.hospitalId
Write-Host "Got token for $hospA"

Write-Host "1b. LOGIN & GET JWT (Target Hosp B)"
$loginTargetRes = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/auth/login' -Method Post -ContentType 'application/json' -Body '{"hospitalName": "City General", "hospitalCode": "HOSP-PASS"}'
$tokenTarget = $loginTargetRes.token
$hospB = $loginTargetRes.hospitalId
Write-Host "Got token for $hospB"

Write-Host "2. MATCH HOSPITALS"
$headersOrigin = @{ Authorization = "Bearer $tokenOrigin" }
$matchRes = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/referrals/match' -Method Post -Headers $headersOrigin -ContentType 'application/json' -Body '{"requiredCapabilities": ["NEUROSURGERY"], "requiredResources": ["ICU_BED"], "priority": "CRITICAL"}'
Write-Host "Match Count: $($matchRes.matches.Count)"

Write-Host "3. CREATE REFERRAL"
$body = '{"targetHospitalId": "' + $hospB + '", "requirementSummary": "Severe head trauma", "requiredCapabilities": ["NEUROSURGERY"], "requiredResources": ["ICU_BED"], "priority": "CRITICAL", "patientData": {"name": "John Doe", "vitals": "Unstable"}}'
$refRes = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/referrals' -Method Post -Headers $headersOrigin -ContentType 'application/json' -Body $body
$refId = $refRes.id
Write-Host "Created Referral $refId"

Write-Host "4. ACCEPT REFERRAL (Target Hosp B)"
$headersTarget = @{ Authorization = "Bearer $tokenTarget" }
$acceptRes = Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/referrals/$refId/accept" -Method Post -Headers $headersTarget -ContentType 'application/json' -Body '{"staffId": "dr-smith"}'
Write-Host "Accepted referral. Status: $($acceptRes.referral.status)"

Write-Host "5. ASSIGN AMBULANCE"
$ambRes = Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/referrals/$refId/assign-ambulance" -Method Post -Headers $headersOrigin -ContentType 'application/json' -Body '{"ambulanceId": "amb-1"}'
Write-Host "Assigned ambulance. Status: $($ambRes.referral.status)"

Write-Host "6. TEST RBAC PACKET AUTH"
try {
    Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/referrals/$refId/packet" -Method Get -Headers @{ Authorization = "Bearer fake_token" }
} catch {
    Write-Host "Caught 401: $($_.Exception.Message)"
}
$packetRes = Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/referrals/$refId/packet" -Method Get -Headers $headersTarget
Write-Host "Decrypted packet for target: $($packetRes.patientData.name)"

Write-Host "7. TRIGGER REROUTE (Zero out capacity)"
$rerouteBody = '{"referralId": "' + $refId + '"}'
$rerouteRes = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/referrals/simulate-capacity-loss' -Method Post -Headers $headersOrigin -ContentType 'application/json' -Body $rerouteBody
Write-Host "Reroute message: $($rerouteRes.simulationMessage)"
Write-Host "New Target: $($rerouteRes.rerouteResult.newTargetHospitalId)"

Write-Host "Done!"
