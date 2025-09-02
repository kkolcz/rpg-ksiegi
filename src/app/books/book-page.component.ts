import { Component, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BooksService } from './books.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-book-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="container" *ngIf="bookSlug() && page() as pg; else notFound">
      <header class="header">
        <h1>{{ bookName() }}</h1>
        <div class="nav">
          <a [routerLink]="['/']">Początek</a>
        </div>
      </header>

      <section class="sheet" [class.locked]="!unlocked()">
        <ng-container *ngIf="unlocked(); else locked">
          <ng-container [ngSwitch]="pg.kind ?? 'html'">
            <iframe
              *ngSwitchCase="'html'"
              class="frame"
              [src]="safeSrc()"
              title="{{ pg.title }}"
            ></iframe>
            <div *ngSwitchCase="'csv'" class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th *ngFor="let h of tableHeaders()">{{ h }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let row of tableRows(); index as i">
                    <td *ngFor="let h of tableHeaders()">{{ row[h] }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div *ngSwitchCase="'xlsx'" class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th *ngFor="let h of tableHeaders()">{{ h }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let row of tableRows(); index as i">
                    <td *ngFor="let h of tableHeaders()">{{ row[h] }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div *ngSwitchCase="'image'" class="image-wrap">
              <img [src]="asset(pg.src)" [alt]="pg.title" />
            </div>
            <div *ngSwitchCase="'pdf'" class="pdf-wrap">
              <iframe class="frame" [src]="safeSrc()" title="{{ pg.title }}"></iframe>
            </div>
          </ng-container>
        </ng-container>
        <ng-template #locked>
          <div class="lock-panel">
            <p>
              Zaklęcia pieczęci wciąż trzymają tę stronicę. Wypowiedz słowo klucza, a macki
              ciemności ustąpią.
            </p>
            <form (submit)="onSubmit($event)">
              <input
                type="password"
                placeholder="Słowo klucza"
                [value]="password()"
                (input)="password.set($any($event.target).value)"
                autocomplete="off"
              />
              <button type="submit">Rozsuń pieczęć</button>
            </form>
            <p class="hint" *ngIf="error()">
              Słowo nie ma mocy. Szepty z mroku milkną pogardliwie.
            </p>
          </div>
        </ng-template>
      </section>

      <footer class="footer">
        <button (click)="goPrev()" [disabled]="!prev()">Poprzednia stronica</button>
        <span>Strona {{ pg.id }}</span>
        <button (click)="goNext()" [disabled]="!next()">Następna stronica</button>
      </footer>
    </div>

    <!-- Lekki komunikat (toast) dla błędnych haseł itp. -->
    <div class="toast" *ngIf="toast()">{{ toast() }}</div>

    <ng-template #notFound>
      <div class="container">
        <p>Nie znaleziono księgi lub strony.</p>
      </div>
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100dvh;
      }
      :host::after {
        content: '';
        position: fixed;
        inset: 0;
        pointer-events: none;
        background: radial-gradient(40% 30% at 20% 10%, rgba(62, 226, 184, 0.06), transparent 70%),
          radial-gradient(50% 35% at 90% 20%, rgba(62, 226, 184, 0.04), transparent 70%),
          radial-gradient(60% 40% at 80% 100%, rgba(62, 226, 184, 0.05), transparent 70%);
        filter: blur(2px);
        z-index: 0;
      }
      .container {
        max-width: 1100px;
        margin: 0 auto;
        padding: 1rem;
        display: grid;
        gap: 1rem;
        position: relative;
        z-index: 1;
      }
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .header h1 {
        margin: 0;
        letter-spacing: 0.04em;
        text-shadow: 0 0 12px rgba(62, 226, 184, 0.12);
      }
      .nav a {
        color: var(--accent);
        text-decoration: none;
      }
      .nav a:hover {
        color: var(--accent-2);
      }
      .sheet {
        position: relative;
        border: 1px solid var(--border);
        border-radius: 10px;
        overflow: hidden;
        background: linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%);
        min-height: 70dvh;
        display: grid;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.02);
      }
      .frame {
        flex: 1;
        width: 100%;
        height: 70dvh;
        border: 0;
        background: white;
      }
      .table-wrap {
        overflow: auto;
        background: transparent;
      }
      .pdf-wrap {
        display: contents;
      }
      .image-wrap {
        display: grid;
        place-items: center;
        padding: 1rem;
      }
      .image-wrap img {
        max-width: 100%;
        max-height: 70dvh;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: #0b1012;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        border: 1px solid var(--border);
        padding: 0.5rem;
      }
      thead th {
        background: #0f171a;
        color: var(--fg);
      }
      .lock-panel {
        margin: auto;
        text-align: center;
        display: grid;
        gap: 0.75rem;
        padding: 1.25rem;
        border: 1px dashed var(--border);
        border-radius: 10px;
        background: radial-gradient(120% 100% at 50% 0%, rgba(62, 226, 184, 0.05), transparent 60%);
      }
      form {
        display: inline-flex;
        gap: 0.5rem;
      }
      input {
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--surface);
        color: var(--fg);
      }
      button {
        padding: 0.5rem 0.9rem;
        border-radius: 8px;
        border: 1px solid color-mix(in oklab, var(--accent) 60%, #000);
        background: var(--accent);
        color: #00110c;
        cursor: pointer;
      }
      button[disabled] {
        opacity: 0.5;
        cursor: default;
      }
      .footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .hint {
        color: var(--danger);
      }
      .toast {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1b2a2e;
        color: var(--fg);
        border: 1px solid var(--border);
        padding: 0.65rem 1rem;
        border-radius: 10px;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
        z-index: 1000;
      }
    `,
  ],
})
export class BookPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly books = inject(BooksService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly bookSlug = signal<string | null>(null);
  readonly bookName = signal<string>('');
  readonly pageId = signal<string>('');

  readonly page = computed(() => {
    const slug = this.bookSlug();
    const id = this.pageId();
    if (!slug) return undefined;
    return this.books.getPage(slug, id);
  });

  readonly next = computed(() =>
    this.page() ? this.books.nextPage(this.bookSlug()!, this.page()!.id) : undefined
  );
  readonly prev = computed(() =>
    this.page() ? this.books.prevPage(this.bookSlug()!, this.page()!.id) : undefined
  );
  readonly unlocked = computed(() =>
    this.page() ? this.books.isUnlocked(this.bookSlug()!, this.page()!.id) : false
  );

  readonly password = signal('');
  readonly error = signal(false);
  readonly toast = signal('');
  readonly tableHeaders = signal<string[]>([]);
  readonly tableRows = signal<Record<string, any>[]>([]);
  readonly safeSrc = signal<SafeResourceUrl | null>(null);

  constructor() {
    // Nasłuchuj zmian parametrów trasy, aby aktualizować stronę i stan przy każdym przejściu
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      const page = params.get('page');
      this.bookSlug.set(slug);
      const book = slug ? this.books.getBook(slug) : undefined;
      this.bookName.set(book?.name ?? '');
      const current = this.books.getPage(slug ?? '', page ?? undefined);
      if (!current) return;
      this.pageId.set(current.id);
      // reset komunikatu błędu przy zmianie strony
      this.error.set(false);
      const unlocked = this.books.isUnlocked(slug ?? '', current.id);
      // Ustaw src dla iframe (html/pdf) z użyciem sanitizer
      if (unlocked && ((current.kind ?? 'html') === 'html' || current.kind === 'pdf')) {
        this.safeSrc.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.assetUrl(current.src)));
      } else {
        this.safeSrc.set(null);
      }
      // Jeśli arkusz i odblokowane, wczytaj dane
      if (unlocked && (current.kind ?? 'html') !== 'html' && current.kind !== 'pdf') {
        this.loadData(this.assetUrl(current.src), (current.kind ?? 'csv') as 'csv' | 'xlsx');
      } else {
        this.tableHeaders.set([]);
        this.tableRows.set([]);
      }
    });
  }

  onSubmit(e: Event) {
    e.preventDefault();
    const ok = this.books.tryUnlock(this.bookSlug()!, this.page()!.id, this.password());
    this.error.set(!ok);
    if (ok) {
      this.password.set('');
      const pg = this.page();
      if (pg && ((pg.kind ?? 'html') === 'html' || pg.kind === 'pdf')) {
        this.safeSrc.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.assetUrl(pg.src)));
      }
      if (pg && (pg.kind ?? 'html') !== 'html' && pg.kind !== 'pdf') {
        this.loadData(this.assetUrl(pg.src), (pg.kind ?? 'csv') as 'csv' | 'xlsx');
      }
    } else {
      this.showToast('Nieprawidłowe hasło.');
    }
  }

  goNext() {
    const n = this.next();
    if (!n) return;
    const slug = this.bookSlug()!;
    if (!this.books.isUnlocked(slug, n.id)) {
      const pwd = window.prompt(this.promptLabel(n.id)) ?? '';
      if (!this.books.tryUnlock(slug, n.id, pwd)) {
        this.error.set(true);
        this.showToast('Nieprawidłowe hasło.');
        return;
      }
    }
    this.router.navigate(['/', slug, n.id]);
    const next = this.books.getPage(slug, n.id)!;
    if ((next.kind ?? 'html') === 'html' || next.kind === 'pdf') {
      this.safeSrc.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.assetUrl(next.src)));
    }
  }

  goPrev() {
    const p = this.prev();
    if (!p) return;
    const slug = this.bookSlug()!;
    if (!this.books.isUnlocked(slug, p.id)) {
      const pwd = window.prompt(this.promptLabel(p.id)) ?? '';
      if (!this.books.tryUnlock(slug, p.id, pwd)) {
        this.error.set(true);
        this.showToast('Nieprawidłowe hasło.');
        return;
      }
    }
    this.router.navigate(['/', slug, p.id]);
    const prev = this.books.getPage(slug, p.id)!;
    if ((prev.kind ?? 'html') === 'html' || prev.kind === 'pdf') {
      this.safeSrc.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.assetUrl(prev.src)));
    }
  }

  private showToast(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 1800);
  }

  private async loadData(src: string, kind: 'csv' | 'xlsx') {
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let workbook: XLSX.WorkBook;
      if (kind === 'csv') {
        const text = await res.text();
        workbook = XLSX.read(text, { type: 'string' });
      } else {
        const buf = await res.arrayBuffer();
        workbook = XLSX.read(buf, { type: 'array' });
      }
      const first = workbook.SheetNames[0];
      const sheet = workbook.Sheets[first];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
      const headers = rows.length ? Object.keys(rows[0]) : [];
      this.tableHeaders.set(headers);
      this.tableRows.set(rows);
    } catch (e) {
      console.error('Błąd ładowania danych arkusza:', e);
      this.tableHeaders.set([]);
      this.tableRows.set([]);
    }
  }

  // Zamienia /uploads/... na absolutny URL backendu, aby nie trafiać w port 4200
  asset(src: string) {
    return this.assetUrl(src);
  }

  private assetUrl(src: string): string {
    if (!src) return src;
    if (/^https?:\/\//i.test(src)) return src;
    if (src.startsWith('/uploads/')) return 'http://localhost:4000' + src;
    return src;
  }

  private promptLabel(id: string): string {
    return `Wypowiedz słowo klucza dla stronnicy ${id}`;
  }
}
