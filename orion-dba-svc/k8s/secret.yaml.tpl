apiVersion: v1
kind: Secret
metadata:
  name: orion-dba-secrets
  namespace: orion
  labels:
    app: orion-dba
type: Opaque
stringData:
  # API key for Yearning backend authentication
  yearning-api-key: "YOUR_YEARNING_API_KEY"
  # API key for platform service to call DBA service
  service-api-key: "YOUR_SERVICE_API_KEY"