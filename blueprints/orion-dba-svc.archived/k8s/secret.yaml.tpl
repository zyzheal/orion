# Secret template - Replace placeholder values with actual secrets
# DO NOT commit real secrets to version control
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
  yearning-api-key: "<CHANGE_ME>"
  # API key for platform service to call DBA service
  service-api-key: "<CHANGE_ME>"