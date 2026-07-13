// Centralized PostHog analytics service.
// All product analytics for Academic Compass are dispatched through here.

import posthog, { type PostHog } from "posthog-js";

const POSTHOG_KEY = "phc_nYtvZwkAYZb7xwK83rTw93jovqNJZ8cLorZH2gf57hCj";
const POSTHOG_HOST = "https://us.i.posthog.com";

type Props = Record<string, unknown>;

let initialized = false;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function client(): PostHog | null {
  if (!isBrowser()) return null;
  if (!initialized) return null;
  return posthog;
}

export function initAnalytics(): void {
  if (!isBrowser() || initialized) return;
  try {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: true,
      person_profiles: "identified_only",
      session_recording: { maskAllInputs: true },
      loaded: () => {
        initialized = true;
      },
    });
    initialized = true;
  } catch (err) {
    // Never let analytics break the app.
    console.warn("PostHog init failed", err);
  }
}

export type IdentifyPayload = {
  user_id: string;
  email?: string | null;
  full_name?: string | null;
  university?: string | null;
  year_of_study?: string | null;
  branch?: string | null;
  onboarding_completed?: boolean | null;
};

export function identifyUser(p: IdentifyPayload): void {
  const c = client();
  if (!c) return;
  const { user_id, ...rest } = p;
  try {
    c.identify(user_id, { user_id, ...rest });
  } catch (err) {
    console.warn("PostHog identify failed", err);
  }
}

export function resetAnalytics(): void {
  const c = client();
  if (!c) return;
  try {
    c.reset();
  } catch (err) {
    console.warn("PostHog reset failed", err);
  }
}

export function track(event: string, properties?: Props): void {
  const c = client();
  if (!c) return;
  try {
    c.capture(event, {
      timestamp: new Date().toISOString(),
      page_url: isBrowser() ? window.location.href : undefined,
      ...properties,
    });
  } catch (err) {
    console.warn("PostHog capture failed", err);
  }
}

export function capturePageview(url?: string): void {
  const c = client();
  if (!c) return;
  try {
    c.capture("$pageview", { $current_url: url ?? (isBrowser() ? window.location.href : undefined) });
  } catch {
    /* ignore */
  }
}

// -------------- Typed event helpers --------------

export const analytics = {
  // Auth
  userSignedUp: (p: Props = {}) => track("User Signed Up", p),
  userLoggedIn: (p: Props = {}) => track("User Logged In", p),
  userLoggedOut: (p: Props = {}) => track("User Logged Out", p),

  // Onboarding
  onboardingStarted: (p: Props = {}) => track("Onboarding Started", p),
  onboardingCompleted: (p: Props = {}) => track("Onboarding Completed", p),

  // Dashboard
  dashboardViewed: (p: Props = {}) => track("Dashboard Viewed", p),

  // Assignments
  assignmentUploaded: (p: Props = {}) => track("Assignment Uploaded", p),
  assignmentEdited: (p: Props = {}) => track("Assignment Edited", p),
  assignmentDeleted: (p: Props = {}) => track("Assignment Deleted", p),
  assignmentMarkedComplete: (p: Props = {}) => track("Assignment Marked Complete", p),

  // AI Analysis
  aiAnalysisStarted: (p: Props = {}) => track("AI Analysis Started", p),
  aiAnalysisCompleted: (p: Props = {}) => track("AI Analysis Completed", p),
  aiAnalysisFailed: (p: Props = {}) => track("AI Analysis Failed", p),

  // Roadmap
  roadmapGenerated: (p: Props = {}) => track("Roadmap Generated", p),
  roadmapRegenerated: (p: Props = {}) => track("Roadmap Regenerated", p),
  roadmapDownloaded: (p: Props = {}) => track("Roadmap Downloaded", p),

  // Compass
  compassOpened: (p: Props = {}) => track("Compass AI Opened", p),
  compassMessageSent: (p: Props = {}) => track("Compass AI Message Sent", p),
  compassResponseGenerated: (p: Props = {}) => track("Compass AI Response Generated", p),

  // Profile
  profileUpdated: (p: Props = {}) => track("Profile Updated", p),

  // Settings
  themeChanged: (p: Props = {}) => track("Theme Changed", p),
  notificationPreferenceChanged: (p: Props = {}) =>
    track("Notification Preference Changed", p),
};
