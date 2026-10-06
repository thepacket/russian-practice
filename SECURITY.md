# Security policy

Russian Word Practice handles each user's own Azure Speech key in their browser, so security reports are welcome.

## Reporting a vulnerability

Please **do not open a public issue or discussion** for a security problem. Report it privately through GitHub's [private vulnerability reporting](https://github.com/thepacket/russian-practice/security/advisories/new) for this repository.

Include what you found, how to reproduce it, and what an attacker could do with it. You should get a reply within a week. Please give a reasonable chance to fix the issue before disclosing it publicly.

## In scope

- Anything that could expose a user's Azure key or short-lived Azure token to anyone other than Microsoft's Azure endpoints
- Cross-site scripting or other ways to run code on the app's origin (which could read a remembered key)
- Weaknesses in the Content Security Policy or other headers in `nginx.conf`
- Speech requests sent somewhere other than the fixed East US Azure endpoints

## Out of scope

- Keys remembered on a device someone else can use; the setup screen warns about shared devices
- Azure's own services, billing and retention
- Issues that need a malicious browser extension or a compromised device

## If your Azure key may be exposed

Rotate it in the Azure portal (Speech resource → Keys and Endpoint → Regenerate). That invalidates the old key immediately; **Forget key on this device** only removes the app's copy.
