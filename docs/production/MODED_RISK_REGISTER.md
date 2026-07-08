# Moded risk register

| Risk | Mode | Mitigation |
| --- | --- | --- |
| Memory pollution | bypass | explicit selection and audit |
| Accidental global rule | trusted | keep global writes pending |
| User friction | approval | trusted mode for low-risk notes |
| Silent fallback | all | default to approval on unknown config |

## Safety rule

Every mode trades speed and control differently. The install flow must make that trade visible.
