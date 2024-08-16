#!/bin/bash
#TODO: Add if for hillrom.com vs hrdev.io

ENVIRONMENT=$1
TENANT=$2
JWT=$3

TLD='hrdev.io'
if [ "$ENVIRONMENT" = "stage" ] || [ "$ENVIRONMENT" = "sbx" ] || [ "$ENVIRONMENT" = "prod" ]
then
  TLD='hillrom.com'
fi

echo ""

curl -X GET \
  "https://${ENVIRONMENT}-sf.zen.${TLD}/Catalog/CatalogService/api/v1.0/Tenant/Identifier/${TENANT}" \
  -H "accept: text/plain" \
  -H "Authorization: Bearer ${JWT}" \
  --verbose

echo ""
