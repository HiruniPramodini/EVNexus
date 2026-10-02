fetch('http://localhost:5000/api/payment/wallet', {
    method: 'GET',
    headers: { 
        'Accept': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJEUlYtMDFEM0IzRkJEN0VDNEE4QzlBNzkzNDRGM0VDQTZBMDAiLCJuYW1laWQiOiJEUlYtMDFEM0IzRkJEN0VDNEE4QzlBNzkzNDRGM0VDQTZBMDAiLCJkcml2ZXJfaWQiOiJEUlYtMDFEM0IzRkJEN0VDNEE4QzlBNzkzNDRGM0VDQTZBMDAiLCJlbWFpbCI6WyJ0ZXN0ZHJpdmVyOTk5QGV4YW1wbGUuY29tIiwidGVzdGRyaXZlcjk5OUBleGFtcGxlLmNvbSJdLCJuYW1lIjoiVGVzdCBEcml2ZXIiLCJ1bmlxdWVfbmFtZSI6IlRlc3QgRHJpdmVyIiwicm9sZSI6WyJEcml2ZXIiLCJEcml2ZXIiXSwianRpIjoiN2YxODE4ZmYtYWMwZC00MDExLWEzNGEtZDQ2NTYzMmZmODgxIiwibmJmIjoxNzkwNjgzNzQ2LCJleHAiOjE3OTA2ODczNDYsImlhdCI6MTc5MDY4Mzc0NiwiaXNzIjoiRVZOZXh1cy5BdXRoU2VydmljZSIsImF1ZCI6IkVWTmV4dXMuTWljcm9zZXJ2aWNlcyJ9.MBdmUe13oBJrydAVubIZRcLH_iDjDLtq5T1Mz8td5aY`
    }
})
.then(res => { console.log(res.status); return res.text(); })
.then(data => console.log(data))
.catch(console.error);
