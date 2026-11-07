# Third-Party Notices

Money Manager itself is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE).
It builds on open-source software and references that keep their own licenses. This document lists every direct dependency, borrowed utility, and upstream reference with its license, split by whether its code ships inside the application.

License texts: [MIT](https://opensource.org/licenses/MIT) · [Apache-2.0](https://opensource.org/licenses/Apache-2.0) · [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.html) · [BSD-3-Clause](https://opensource.org/licenses/BSD-3-Clause)

---

## 1. Upstream projects & borrowed engines

| Project | Role | License | Upstream Link |
| --- | --- | --- | --- |
| **Actual Budget** | Rule engine and bank statement importer parsers (CSV, QIF, OFX) | MIT | [GitHub](https://github.com/actualbudget/actual) · [License](https://github.com/actualbudget/actual/blob/master/LICENSE) |
| **Wealthfolio** | Desktop architecture, local-first SQLite patterns, and Tauri reference | AGPL-3.0 | [GitHub](https://github.com/wealthfolio/wealthfolio) · [License](https://github.com/wealthfolio/wealthfolio/blob/main/LICENSE) |
| **Realbyte Money Manager** | User experience philosophy, calendar grid layout, and SQLite database schema compatibility target (No proprietary source code incorporated). | Proprietary | [Realbyte Inc.](https://realbyteapps.com) |

---

## 2. Dependencies that ship inside the app

| Package / Library | Purpose | License | Upstream Link |
| --- | --- | --- | --- |
| `vue` | Reactive user interface framework | MIT | [License](https://github.com/vuejs/core/blob/main/LICENSE) |
| `pinia` | State management for accounts, calendar, and active views | MIT | [License](https://github.com/vuejs/pinia/blob/v2/LICENSE) |
| `sql.js` / `@tauri-apps/plugin-sql` | SQLite database access and query execution | MIT | [License](https://github.com/sql-js/sql.js/blob/master/LICENSE) |
| `lucide-vue-next` | Clean UI icons for categories, accounts, and navigation | ISC | [License](https://github.com/lucide-icons/lucide/blob/main/LICENSE) |
| `date-fns` | Date calculations, calendar matrix math, and timezone handling | MIT | [License](https://github.com/date-fns/date-fns/blob/main/LICENSE.md) |

---

## 3. Build / test only — not shipped

| Package / Library | Purpose | License | Upstream Link |
| --- | --- | --- | --- |
| `@tauri-apps/cli` | Desktop compilation and portable `.exe` packager | MIT / Apache-2.0 | [License](https://github.com/tauri-apps/tauri/blob/dev/LICENSE_MIT) |
| `vite` | Next-generation frontend tooling and fast dev server | MIT | [License](https://github.com/vitejs/vite/blob/main/LICENSE.md) |
| `typescript` | Static type checking and compiler | Apache-2.0 | [License](https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt) |
| `tailwindcss` | Utility-first CSS styling framework | MIT | [License](https://github.com/tailwindlabs/tailwindcss/blob/master/LICENSE) |
| `vitest` | Unit and math logic test suite (Sanchaypatra slab tests) | MIT | [License](https://github.com/vitest-dev/vitest/blob/main/LICENSE) |

---

### Notice & Copyright Reproductions

#### Actual Budget — Copyright (c) 2018-2024 Actual Budget Contributors

```text
MIT License

Copyright (c) 2018-2024 Actual Budget Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
