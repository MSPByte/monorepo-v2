# Helpers

#### The Facet fetch intervals can be customized per customer integrations.config or integration_link.metadata

```
{
  "pipeline": {
    "facets": {
      "m365_identities": { "intervalMs": 900000 },
      "m365_teams_config": { "intervalMs": 86400000 }
    }
  }
}
```
