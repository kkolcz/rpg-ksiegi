import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';

export type BookPage = {
  id: string; // page id, used in route and to load content
  title: string; // optional display title
  src: string; // path to data (csv/xlsx) or html
  kind?: 'html' | 'csv' | 'xlsx' | 'image' | 'pdf'; // how to render
  password: string; // password required to unlock this page
};

export type Book = {
  slug: string; // url slug, e.g., 'asdasd' for Liber Ivonis
  name: string; // display name
  pages: BookPage[];
};

@Injectable({ providedIn: 'root' })
export class BooksService {
  private readonly books = signal<Book[]>([]);
  private readonly loaded = signal(false);

  // Keeps track of which pages are unlocked per book slug
  private readonly unlocked = signal<Record<string, Set<string>>>({});

  constructor(private router: Router) {
    // Spróbuj pobrać konfigurację z backendu, a w razie potrzeby fallback do pliku
    this.loadConfig('http://localhost:4000/api/books', '/config/books.json');
  }

  private async loadConfig(primaryUrl: string, fallbackUrl?: string) {
    try {
      const res = await fetch(primaryUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Book[];
      // prosta weryfikacja kształtu
      if (Array.isArray(data)) {
        this.books.set(data);
        this.loaded.set(true);
      } else {
        console.error('Nieprawidłowy format pliku konfiguracyjnego:', data);
      }
    } catch (err) {
      console.warn('Błąd wczytywania z backendu, próba fallbacku:', err);
      if (fallbackUrl) {
        try {
          const res = await fetch(fallbackUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as Book[];
          if (Array.isArray(data)) {
            this.books.set(data);
            this.loaded.set(true);
            return;
          }
        } catch (e2) {
          console.error('Błąd wczytywania fallbacku z pliku:', e2);
        }
      }
    }
  }

  readonly getBooks = computed(() => this.books());
  readonly isLoaded = computed(() => this.loaded());

  getBook(slug: string): Book | undefined {
    return this.books().find((b) => b.slug === slug);
  }

  getPage(slug: string, pageId?: string): BookPage | undefined {
    const book = this.getBook(slug);
    if (!book) return undefined;
    if (!pageId) return book.pages[0];
    return book.pages.find((p) => p.id === pageId) ?? book.pages[0];
  }

  isUnlocked(slug: string, pageId: string): boolean {
    const map = this.unlocked();
    const set = map[slug];
    return !!set && set.has(pageId);
  }

  tryUnlock(slug: string, pageId: string, pwd: string): boolean {
    const page = this.getPage(slug, pageId);
    if (!page) return false;
    if (pwd.trim() === page.password) {
      const map = { ...this.unlocked() };
      const set = new Set(map[slug] ?? []);
      set.add(pageId);
      map[slug] = set;
      this.unlocked.set(map);
      return true;
    }
    return false;
  }

  nextPage(slug: string, pageId: string): BookPage | undefined {
    const book = this.getBook(slug);
    if (!book) return undefined;
    const idx = book.pages.findIndex((p) => p.id === pageId);
    return idx >= 0 && idx + 1 < book.pages.length ? book.pages[idx + 1] : undefined;
  }

  prevPage(slug: string, pageId: string): BookPage | undefined {
    const book = this.getBook(slug);
    if (!book) return undefined;
    const idx = book.pages.findIndex((p) => p.id === pageId);
    return idx > 0 ? book.pages[idx - 1] : undefined;
  }
}
