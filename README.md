[![MIT License][license-image]][license-url]
[![ci][ci-image]][ci-url]
[![CodeQL][codeql-image]][codeql-url]
[![Known Vulnerabilities][snyk-image]][snyk-url]
[![Style Status][style-image]][style-url]

[license-image]: https://img.shields.io/github/license/zenosmosis/sync-object
[license-url]: https://raw.githubusercontent.com/zenOSmosis/sync-object/master/LICENSE.txt
[ci-image]: https://github.com/zenosmosis/sync-object/actions/workflows/ci.yml/badge.svg
[ci-url]: https://github.com/zenOSmosis/sync-object/actions/workflows/ci.yml
[codeql-image]: https://github.com/zenosmosis/sync-object/workflows/CodeQL/badge.svg
[codeql-url]: https://github.com/zenOSmosis/sync-object/actions/workflows/codeql-analysis.yml
[snyk-image]: https://snyk.io/test/github/zenosmosis/sync-object/badge.svg
[snyk-url]: https://snyk.io/test/github/zenosmosis/sync-object
[style-image]: https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square
[style-url]: https://prettier.io/


# Sync Object

Share a serializable JavaScript Object between two or more peers, using a recursive differential algorithm to keep over-the-air updates as light as possible, even for deeply nested objects.

Utilized in https://speaker.app / https://github.com/zenOSmosis/speaker.app in order to keep WebRTC participant states in sync over WebRTC data channels.

Built on top of [PhantomCore](https://github.com/zenOSmosis/phantom-core),an EventEmitter-based, object-oriented application architecture for browsers and Node.js, featuring lifecycle management.

## Note Before Using

Documentation is still a work in progress and the API is subject to change.

Currently does not handle arrays for property values; must use dictionary-type objects.

## License

[MIT License](https://github.com/zenOSmosis/sync-object/blob/master/LICENSE.txt). Copyright (c) [zenOSmosis](https://zenosmosis.com)
