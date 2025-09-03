import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AdminService } from './admin.service';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="wrap">
      <header class="head">
        <h2>Katalog</h2>
        <div class="spacer"></div>
        <button class="ghost" (click)="newBook()" [disabled]="creatingBook()">Nowa księga</button>
        <button class="ghost" (click)="exportJson()">Eksport JSON</button>
        <button class="ghost" (click)="importJson()">Import JSON</button>
        <button class="ghost" (click)="logout()">Wyloguj</button>
      </header>

      <div *ngIf="loading()" class="info">Ładowanie…</div>
      <div *ngIf="error()" class="err">{{ error() }}</div>

      <table *ngIf="!loading()" class="tbl">
        <thead>
          <tr>
            <th>Nazwa</th>
            <th>Slug</th>
            <th>Stron</th>
            <th>Typ</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let b of books()">
            <td>{{ b.name }}</td>
            <td>
              <button class="link" (click)="chooseSlug(b.slug)">{{ b.slug }}</button>
            </td>
            <td>{{ b.pages?.length || 0 }}</td>
            <td>{{ typeOf(b) }}</td>
            <td class="actions">
              <button class="danger" (click)="remove(b.id, b.slug)">Usuń</button>
            </td>
          </tr>
        </tbody>
      </table>
      <section class="edit">
        <h3>Dodaj/edytuj stronę</h3>
        <form (submit)="savePage($event)" class="form">
          <label
            >Numer strony
            <input
              type="text"
              [value]="pageForm.pageNumber"
              (input)="pageForm.pageNumber = $any($event.target).value"
              required
            />
          </label>
          <label
            >Tytuł
            <input
              type="text"
              [value]="pageForm.title"
              (input)="pageForm.title = $any($event.target).value"
              required
            />
          </label>
          <label
            >Slug księgi
            <input
              type="text"
              [value]="pageForm.slug"
              (input)="pageForm.slug = $any($event.target).value"
              required
            />
          </label>
          <label
            >Typ
            <select [value]="pageForm.kind" (change)="pageForm.kind = $any($event.target).value">
              <option value="csv">csv</option>
              <option value="xlsx">xlsx</option>
              <option value="image">image</option>
              <option value="pdf">pdf</option>
              <option value="html">html</option>
            </select>
          </label>
          <label
            >Źródło (URL)
            <input
              type="text"
              [value]="pageForm.src"
              (input)="pageForm.src = $any($event.target).value"
              placeholder="/uploads/.. lub pełny URL"
            />
          </label>
          <label
            >Lub wyślij plik
            <input type="file" (change)="onFile($event)" />
          </label>
          <label
            >Hasło do strony
            <input
              type="text"
              [value]="pageForm.password"
              (input)="pageForm.password = $any($event.target).value"
            />
          </label>
          <button type="submit">Zapisz stronę</button>
        </form>
      </section>

      <section class="edit">
        <h3>Nowa/edycja księgi</h3>
        <form (submit)="saveBook($event)" class="form">
          <label
            >Slug księgi
            <input
              type="text"
              [value]="bookForm.slug"
              (input)="bookForm.slug = $any($event.target).value"
              required
            />
          </label>
          <label
            >Nazwa księgi
            <input
              type="text"
              [value]="bookForm.name"
              (input)="bookForm.name = $any($event.target).value"
              required
            />
          </label>
          <button type="submit">Zapisz księgę</button>
        </form>
      </section>

      <section class="edit">
        <h3>Narzędzia</h3>
        <div class="form">
          <button class="ghost" (click)="runNormalize()">Normalizuj URL-e (uploads)</button>
        </div>
        <div *ngIf="normalizeInfo() as n" class="mono">
          <div>normalize changed: {{ n.changed }}</div>
        </div>
      </section>

      <section class="edit" *ngIf="books().length">
        <h3>Strony w księgach</h3>
        <div class="pages" *ngFor="let b of books()">
          <h4>{{ b.name }} ({{ b.slug }})</h4>
          <table class="tbl">
            <thead>
              <tr>
                <th>Nr</th>
                <th>Tytuł</th>
                <th>Typ</th>
                <th>Src</th>
                <th>Hasło</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let p of b.pages">
                <td>{{ p.pageNumber }}</td>
                <td>{{ p.title }}</td>
                <td>{{ p.kind || 'csv' }}</td>
                <td class="mono">{{ p.src }}</td>
                <td class="mono">{{ p.password }}</td>
                <td>
                  <button class="ghost" (click)="editPage(b.slug, p)">Edytuj</button>
                  <button class="danger" (click)="removePage(b.slug, p.pageNumber)">Usuń</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="quick-add">
            <button class="ghost" (click)="quickAddPage(b.slug)">
              Dodaj stronę do {{ b.slug }}
            </button>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      .wrap {
        max-width: 960px;
        margin: 2rem auto;
        padding: 0 1rem;
        display: grid;
        gap: 1rem;
      }
      .head {
        display: flex;
        align-items: center;
        gap: 1rem;
      }
      .spacer {
        flex: 1;
      }
      .ghost {
        padding: 0.45rem 0.75rem;
        border-radius: 8px;
        border: 1px solid var(--border);
        background: transparent;
        color: var(--fg);
      }
      .link {
        background: none;
        border: none;
        color: var(--accent);
        cursor: pointer;
        text-decoration: underline;
        padding: 0;
      }
      .tbl {
        width: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        text-align: left;
        padding: 0.5rem 0.75rem;
        border-bottom: 1px solid var(--border);
      }
      .danger {
        padding: 0.35rem 0.6rem;
        border-radius: 6px;
        border: 1px solid #4b1b1b;
        background: #7a2424;
        color: #fff;
      }
      .err {
        color: var(--danger);
      }
      .edit {
        border-top: 1px solid var(--border);
        padding-top: 1rem;
      }
      .form {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 0.75rem;
        align-items: end;
      }
      .form input,
      .form select {
        width: 100%;
        padding: 0.5rem 0.7rem;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--surface);
        color: var(--fg);
      }
      .form button {
        padding: 0.6rem 1rem;
        border-radius: 8px;
        border: 1px solid color-mix(in oklab, var(--accent) 60%, #000);
        background: var(--accent);
        color: #00110c;
        cursor: pointer;
      }
      .pages {
        margin-top: 0.75rem;
      }
      .mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 0.85em;
      }
    `,
  ],
})
export class AdminPanelComponent implements OnInit {
  private readonly svc = inject(AdminService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly books = signal<any[]>([]);
  pageForm: any = { pageNumber: '', title: '', slug: '', kind: 'csv', src: '', password: 'test' };
  bookForm: any = { slug: '', name: '' };
  readonly normalizeInfo = signal<any | null>(null);
  readonly creatingBook = signal(false);

  async ngOnInit() {
    if (!this.svc.token()) {
      this.router.navigateByUrl('/admin/login');
      return;
    }
    await this.refresh();
  }

  async refresh() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const data = await this.svc.listBooks();
      this.books.set(data);
    } catch (e: any) {
      this.error.set(e.message ?? 'Błąd');
    } finally {
      this.loading.set(false);
    }
  }

  typeOf(b: any): string {
    const kinds = new Set((b?.pages ?? []).map((p: any) => p?.kind));
    if (kinds.size === 1 && kinds.has('image')) return 'Obraz';
    if (kinds.size === 1 && kinds.has('pdf')) return 'Dokument';
    return 'Księga';
  }

  logout() {
    this.svc.logout();
    this.router.navigateByUrl('/admin/login');
  }

  async remove(id: string, slug: string) {
    if (!confirm(`Usunąć "${slug}"?`)) return;
    try {
      await this.svc.deleteBook(id);
      await this.refresh();
    } catch (e: any) {
      alert(e.message ?? 'Błąd usuwania');
    }
  }

  async exportJson() {
    try {
      const data = await this.svc.listBooks();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'books-export.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message ?? 'Błąd eksportu');
    }
  }

  async runNormalize() {
    try {
      const res = await this.svc.normalizeSrc(false);
      this.normalizeInfo.set(res);
      await this.refresh();
    } catch (e: any) {
      alert(e.message ?? 'Błąd normalizacji');
    }
  }

  async importJson() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const payload = JSON.parse(text);
        const t = this.svc.token();
        const res = await fetch('http://localhost:5200/api/admin/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${t}`,
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Błąd importu');
        await this.refresh();
        alert('Zaimportowano.');
      } catch (e: any) {
        alert(e.message ?? 'Błąd importu');
      }
    };
    input.click();
  }

  async onFile(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const res = await this.svc.uploadFile(file);
      this.pageForm.src = res.url; // ustawia ścieżkę /uploads/...
      alert('Plik wgrany: ' + res.originalName);
    } catch (e: any) {
      alert(e.message ?? 'Błąd uploadu');
    }
  }

  async savePage(ev: Event) {
    ev.preventDefault();
    const { slug, ...page } = this.pageForm;
    if (!slug) return alert('Podaj slug księgi');
    const b = this.books().find((x) => x.slug === slug);
    if (!b?.id) return alert('Nie znaleziono księgi o podanym slugu');
    // Upewnij się, że pageNumber jest liczbą
    if (typeof page.pageNumber === 'string') {
      const n = parseInt(page.pageNumber, 10);
      if (!Number.isFinite(n)) return alert('Nieprawidłowy numer strony');
      page.pageNumber = n;
    }
    try {
      await this.svc.upsertPage(b.id, page);
      await this.refresh();
      alert('Zapisano stronę');
    } catch (e: any) {
      alert(e.message ?? 'Błąd zapisu');
    }
  }

  editPage(slug: string, p: any) {
    this.pageForm = {
      slug,
      pageNumber: p.pageNumber,
      title: p.title,
      kind: p.kind || 'csv',
      src: p.src,
      password: p.password,
    };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async removePage(slug: string, pageNumber: string | number) {
    if (!confirm(`Usunąć stronę ${pageNumber} z ${slug}?`)) return;
    try {
      await this.svc.deletePage(slug, pageNumber);
      await this.refresh();
    } catch (e: any) {
      alert(e.message ?? 'Błąd usuwania strony');
    }
  }

  async saveBook(ev: Event) {
    ev.preventDefault();
    try {
      const existing = this.books().find((b) => b.slug === this.bookForm.slug);
      const book = existing
        ? { id: existing.id, slug: existing.slug, name: this.bookForm.name }
        : { slug: this.bookForm.slug, name: this.bookForm.name };
      await this.svc.saveBook(book);
      await this.refresh();
      alert('Zapisano książkę');
    } catch (e: any) {
      alert(e.message ?? 'Błąd zapisu książki');
    }
  }

  chooseSlug(slug: string) {
    this.pageForm.slug = slug;
    this.bookForm.slug = slug;
    if (!this.pageForm.pageNumber) {
      this.pageForm.pageNumber = this.getNextPageNumber(slug);
    }
  }

  async newBook() {
    // Przygotuj formularz do ręcznego wypełnienia i przewiń do sekcji
    this.bookForm = { slug: '', name: '' };
    this.pageForm.slug = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private generateUuid(): string {
    // Preferuj wbudowane crypto.randomUUID
    const g = globalThis as any;
    if (g?.crypto?.randomUUID) return g.crypto.randomUUID();
    // Fallback: RFC4122 v4 na bazie crypto.getRandomValues lub Math.random
    const getRandom = () => {
      if (g?.crypto?.getRandomValues) {
        const arr = new Uint8Array(1);
        g.crypto.getRandomValues(arr);
        return arr[0] / 255;
      }
      return Math.random();
    };
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (getRandom() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  quickAddPage(slug: string) {
    const nextId = this.getNextPageNumber(slug);
    this.pageForm = { pageNumber: nextId, title: '', slug, kind: 'csv', src: '', password: 'test' };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private getNextPageNumber(slug: string): string {
    const b = this.books().find((x) => x.slug === slug);
    const pages = (b?.pages ?? []) as Array<{ pageNumber: string | number }>;
    const nums = pages
      .map((p) => Number(p.pageNumber))
      .filter((n) => Number.isFinite(n)) as number[];
    const maxNum = nums.length ? Math.max(...nums) : 0;
    let candidate = String(maxNum + 1);
    // Upewnij się, że unikalny (porównuj jako string liczb)
    const existing = new Set(pages.map((p) => String(p.pageNumber)));
    while (existing.has(candidate)) {
      candidate = String(parseInt(candidate, 10) + 1);
    }
    return candidate;
  }
}
