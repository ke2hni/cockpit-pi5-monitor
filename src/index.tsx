/*
 * SPDX-License-Identifier: LGPL-2.1-or-later
 *
 * Copyright (C) 2017 Red Hat, Inc.
 * Copyright (C) 2026 Jeff Milne - KE2HNI
 */

import React from 'react';

/*
 * React entrypoint for the Pi 5 Monitor Cockpit plugin.
 * This file boots the application after the page DOM is ready.
 */
import { createRoot } from 'react-dom/client';

/*
 * Cockpit theme integration so the plugin follows shell light/dark behavior.
 */
import "cockpit-dark-theme";

import { Application } from './app.jsx';

import "patternfly/patternfly-6-cockpit.scss";
import './app.scss';

/*
 * Mount the main Application component into the page container.
 */
document.addEventListener("DOMContentLoaded", () => {
    createRoot(document.getElementById("app")!).render(<Application />);
});
