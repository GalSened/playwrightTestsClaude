#!/bin/bash

cd "$(dirname "$0")"

echo "=========================================="
echo "Running All WeSign API Test Collections"
echo "=========================================="
echo ""

# Array of collection files
collections=(
    "Templates_Module_Tests.postman_collection.json"
    "Contacts_Module_Tests.postman_collection.json"
    "SelfSign_Module_Tests.postman_collection.json"
    "Admins_Module_Tests.postman_collection.json"
    "DocumentCollections_Expansion_Tests.postman_collection.json"
    "Final_Gap_Tests.postman_collection.json"
)

# Run each collection
for collection in "${collections[@]}"; do
    name="${collection%.postman_collection.json}"
    echo "Running: $name"
    newman run "$collection" \
        -e "WeSign_Unified_Environment.postman_environment.json" \
        -r htmlextra,cli \
        --reporter-htmlextra-export "newman_reports/${name}.html" \
        --insecure \
        --timeout-request 15000
    echo "---"
    echo ""
done

echo "=========================================="
echo "All tests completed!"
echo "Reports saved to: newman_reports/"
echo "=========================================="
