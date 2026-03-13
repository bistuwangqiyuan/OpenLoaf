/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import { registerLicense } from '@syncfusion/ej2-base'

const key = process.env.NEXT_PUBLIC_SYNCFUSION_LICENSE_KEY?.trim() ?? ''

/** Whether the current web bundle has a public Syncfusion license key. */
export const hasSyncfusionPublicLicense = key.length > 0

if (hasSyncfusionPublicLicense) registerLicense(key)
