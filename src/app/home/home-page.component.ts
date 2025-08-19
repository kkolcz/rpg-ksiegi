import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BooksService } from '../books/books.service';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="wrap">
      <header class="hero">
        <img class="emblem" src="/assets/cthulhu-sigil.svg" width="88" height="88" alt="Emblemat" />
        <h1>Zew Ksiąg</h1>
        <p>Wpisz nazwę lub wybierz księgę, aby wejść do jej treści.</p>
      </header>

      <ng-container *ngIf="loaded(); else loading">
        <form class="selector" (submit)="go()">
          <label for="bookInput">Księga</label>
          <input
            id="bookInput"
            type="text"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
            list="books"
            placeholder="np. Liber Ivonis lub Necronomicon"
            autocomplete="off"
          />
          <datalist id="books">
            <option *ngFor="let b of books()" [value]="b.slug">{{ b.name }}</option>
          </datalist>
          <button type="submit">Wejdź</button>
          <span class="hint" *ngIf="error()">Nie znaleziono takiej księgi.</span>
        </form>

        <section class="grid">
          <article
            class="card"
            *ngFor="let b of books()"
            (click)="open(b.slug)"
            tabindex="0"
            (keydown.enter)="open(b.slug)"
          >
            <img class="icon" [src]="emblemFor(b.slug)" height="56" width="56" alt="emblemat" />
            <div class="meta">
              <h3>{{ b.name }}</h3>
              <p class="slug">/{{ b.slug }}</p>
            </div>
            <span class="badge type">{{ typeOf(b) }}</span>
            <button type="button" class="ghost" (click)="$event.stopPropagation(); open(b.slug)">
              Otwórz
            </button>
          </article>
        </section>
      </ng-container>

      <ng-template #loading>
        <div class="loading">
          <p>Ładowanie katalogu…</p>
          <section class="grid">
            <div class="card skeleton" *ngFor="let i of [1, 2, 3, 4]">
              <div class="sk-icon shimmer"></div>
              <div class="sk-line shimmer" style="width: 60%"></div>
              <div class="sk-line shimmer" style="width: 40%"></div>
              <div class="sk-btn shimmer"></div>
            </div>
          </section>
        </div>
      </ng-template>
    </div>
  `,
  styles: [
    `
      .wrap {
        max-width: 960px;
        margin: 0 auto;
        padding: 2rem 1rem;
        display: grid;
        gap: 1.5rem;
      }
      .loading {
        display: grid;
        gap: 1rem;
      }
      .hero {
        text-align: center;
        display: grid;
        gap: 0.5rem;
        justify-items: center;
      }
      .hero h1 {
        margin: 0.25rem 0 0;
        letter-spacing: 0.06em;
        text-shadow: 0 0 18px rgba(62, 226, 184, 0.12);
      }
      .emblem {
        filter: drop-shadow(0 6px 16px rgba(0, 0, 0, 0.4));
      }
      .selector {
        display: grid;
        grid-template-columns: 1fr auto;
        grid-template-rows: auto auto;
        gap: 0.5rem;
        align-items: end;
        justify-items: start;
      }
      .selector label {
        grid-column: 1 / -1;
        color: var(--muted);
      }
      .selector input {
        width: 100%;
        padding: 0.6rem 0.8rem;
        border: 1px solid var(--border);
        border-radius: 10px;
        background: var(--surface);
        color: var(--fg);
      }
      .selector button {
        padding: 0.6rem 1rem;
        border-radius: 10px;
        border: 1px solid color-mix(in oklab, var(--accent) 60%, #000);
        background: var(--accent);
        color: #00110c;
        cursor: pointer;
      }
      .selector .hint {
        color: var(--danger);
        align-self: center;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 1rem;
      }
      .card {
        display: grid;
        grid-auto-rows: max-content;
        gap: 0.5rem;
        align-items: center;
        justify-items: center;
        text-align: center;
        min-height: 220px;
        padding: 1rem;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%);
        cursor: pointer;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.02);
      }
      .card:hover {
        outline: 1px solid color-mix(in oklab, var(--accent) 30%, var(--border));
      }
      .card:focus {
        outline: 2px solid var(--accent);
      }
      .icon {
        border-radius: 8px;
        background: radial-gradient(100% 100% at 50% 0%, rgba(62, 226, 184, 0.08), transparent 70%);
      }
      .meta h3 {
        margin: 0;
        font-weight: 600;
      }
      .meta .slug {
        margin: 0;
        color: var(--muted);
      }
      .ghost {
        padding: 0.45rem 0.75rem;
        border-radius: 8px;
        border: 1px solid var(--border);
        background: transparent;
        color: var(--fg);
      }
      .badge {
        padding: 0.2rem 0.5rem;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: #0f171a;
        color: var(--fg);
        font-size: 0.8rem;
      }
      .badge.type {
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      /* Skeleton */
      .skeleton {
        pointer-events: none;
      }
      .sk-icon {
        width: 56px;
        height: 56px;
        border-radius: 8px;
        background: #0f171a;
      }
      .sk-line {
        height: 14px;
        width: 80%;
        border-radius: 6px;
        background: #0f171a;
      }
      .sk-btn {
        height: 34px;
        width: 90px;
        border-radius: 8px;
        background: #0f171a;
      }
      .shimmer {
        position: relative;
        overflow: hidden;
      }
      .shimmer::after {
        content: '';
        position: absolute;
        inset: 0;
        transform: translateX(-100%);
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.06), transparent);
        animation: shimmer 1.3s infinite;
      }
      @keyframes shimmer {
        100% {
          transform: translateX(100%);
        }
      }
    `,
  ],
})
export class HomePageComponent {
  private readonly router = inject(Router);
  private readonly booksSvc = inject(BooksService);

  readonly books = computed(() => this.booksSvc.getBooks());
  readonly loaded = computed(() => this.booksSvc.isLoaded());
  readonly query = signal('');
  readonly error = signal(false);

  open(slug: string, pageId?: string) {
    if (!slug) return;
    if (pageId) {
      this.router.navigate(['/', slug, pageId]);
    } else {
      this.router.navigate(['/', slug]);
    }
  }

  go() {
    if (!this.loaded()) return;
    const q = this.query().trim().toLowerCase();
    const found = this.books().find(
      (b) => b.slug.toLowerCase() === q || b.name.toLowerCase() === q
    );
    if (!found) {
      this.error.set(true);
      return;
    }
    this.error.set(false);
    this.open(found.slug);
  }

  emblemFor(slug: string): string {
    switch (slug) {
      case 'liber-ivonis':
        return '/assets/elder-sign.svg';
      case 'necronomicon':
        return '/assets/tentacle.svg';
      case 'galeria':
        return '/assets/cthulhu-sigil.svg';
      case 'archiwum-pdf':
        return '/assets/cthulhu-sigil.svg';
      default:
        return '/assets/cthulhu-sigil.svg';
    }
  }

  // Określa typ pozycji na podstawie rodzajów stron w książce
  typeOf(b: any): string {
    const kinds = new Set((b?.pages ?? []).map((p: any) => p?.kind));
    // Jeśli wszystkie strony to obrazy
    if (kinds.size === 1 && kinds.has('image')) return 'Obraz';
    // Jeśli wszystkie strony to dokumenty PDF
    if (kinds.size === 1 && kinds.has('pdf')) return 'Dokument';
    // W pozostałych przypadkach traktujemy jako klasyczną księgę (csv/xlsx/mix)
    return 'Księga';
  }
}
