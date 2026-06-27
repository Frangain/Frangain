# FRANGAIN Ecosystem Development Rules

## Project

This is the official FRANGAIN website and ecosystem.

The project is deployed in production. Existing functionality must always be preserved, and every change must be treated with production-level care.

## Development Philosophy

Implement only the requested milestone.

Never implement future milestones automatically. Never redesign the project. Never introduce architectural changes without explicit approval.

If an improvement, risk, or opportunity is discovered during development, explain it first and wait for approval before making the change.

## Frontend Rules

Existing HTML, CSS, and JavaScript files are production code.

Do not modify existing frontend files unless explicitly requested. Reuse existing styles whenever possible, and preserve the FRANGAIN visual identity across all future work.

## Backend Rules

The backend foundation must use:

- Node.js
- Vercel Serverless Functions
- MongoDB Atlas

Keep backend code modular and organized by responsibility.

Never hardcode secrets. Always use environment variables for configuration, credentials, connection strings, tokens, and deployment-specific values.

## Database

Current MongoDB collections:

- users
- claims
- withdrawals

Do not create additional collections unless explicitly requested.

## Coding Standards

Write clean, readable, and maintainable code.

Keep files focused on a single responsibility. Avoid unnecessary dependencies. Comment complex logic when appropriate, especially where future maintainers need context to understand security, database, or deployment behavior.

## FRANGAIN Terminology

Use the following official terminology consistently unless instructed otherwise:

- FRANGAIN Ecosystem
- Memory Mining
- Memory Reserve
- Mining Session
- Mining Rate
- The Coin Remembers

## Golden Rule

Whenever you are uncertain:

Stop.

Explain your recommendation.

Wait for approval before making architectural changes.
