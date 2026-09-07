// publish-flag.ts — The single publishing-capability switch shared by
// Revyme Cloud and self-hosted deployments.
//
// Revyme Cloud keeps its existing behaviour. Self-hosted publishing is enabled
// independently so it does not also turn on Revyme Cloud authentication,
// billing, marketplace, or collaboration features.

import { CLOUD_ENABLED } from './cloud-flag';

const SELF_HOSTED_PUBLISH_ENABLED =
  import.meta.env.VITE_SELF_HOSTED_PUBLISH === 'true';

export const PUBLISH_ENABLED =
  CLOUD_ENABLED || SELF_HOSTED_PUBLISH_ENABLED;
