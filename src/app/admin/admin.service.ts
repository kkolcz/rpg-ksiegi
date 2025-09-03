import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AdminService {
  readonly token = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  async login(username: string, password: string) {
    this.error.set(null);
    try {
      const res = await fetch('http://localhost:5200/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) throw new Error('Błędne dane logowania');

      // Opcjonalne pobranie tokenu, jeśli backend zacznie go zwracać
      try {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const data = await res.json();
          if (data?.token) this.token.set(data.token);
        } else {
          this.token.set('dummy_token');
          await res.text(); // skonsumuj body dla spójności
        }
      } catch {
        // ignoruj błędy parsowania odpowiedzi
      }

      return true;
    } catch (e: any) {
      this.error.set(e.message ?? 'Błąd logowania');
      return false;
    }
  }

  logout() {
    const t = this.token();
    this.token.set(null);
    if (!t) return;
    fetch('http://localhost:5200/api/auth/logout', {
      headers: { Authorization: `Bearer ${t}` },
      method: 'POST',
    });
  }

  async listBooks() {
    const t = this.token();
    if (!t) throw new Error('Brak autoryzacji');
    const res = await fetch('http://localhost:5200/api/books', {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!res.ok) throw new Error('Błąd pobierania');
    return res.json();
  }

  async deleteBook(id: string) {
    const t = this.token();
    if (!t) throw new Error('Brak autoryzacji');
    const res = await fetch(`http://localhost:5200/api/books/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!res.ok) throw new Error('Błąd usuwania');
    return res.json();
  }

  async uploadFile(file: File) {
    const t = this.token();
    if (!t) throw new Error('Brak autoryzacji');
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('http://localhost:5200/api/file', {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}` },
      body: fd,
    });
    if (!res.ok) throw new Error('Błąd uploadu');

    const toAbsolute = (u?: string | null) => {
      if (!u) return null as any;
      const s = String(u).trim();
      if (/^https?:\/\//i.test(s)) return s;
      return 'http://localhost:5200' + (s.startsWith('/') ? '' : '/') + s;
    };

    // 1) Preferuj URL z nagłówka Location
    const loc = res.headers.get('Location') || res.headers.get('location');
    if (loc) return { url: toAbsolute(loc), originalName: file.name };

    // 2) Fallback: spróbuj JSON (obsługa "src" itd.)
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const data = await res.json();
      const raw = data?.src || data?.url || data?.location || data?.Location || data?.href;
      const url = toAbsolute(raw);
      if (url) return { url, originalName: data?.originalName || file.name };
      return data;
    }

    // 3) Fallback: surowy tekst z URL
    const text = (await res.text())?.trim();
    if (text) {
      const url = toAbsolute(text);
      if (url) return { url, originalName: file.name };
    }

    throw new Error('Brak URL pliku w odpowiedzi (nagłówek Location/JSON nie zawiera linku).');
  }

  async upsertPage(
    bookId: string,
    page: {
      pageNumber: number | string;
      title: string;
      src: string;
      kind?: string;
      password: string;
    }
  ) {
    const t = this.token();
    if (!t) throw new Error('Brak autoryzacji');
    const res = await fetch(`http://localhost:5200/api/page/${encodeURIComponent(bookId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify(page),
    });
    if (!res.ok) throw new Error('Błąd zapisu strony');
    return res.json();
  }

  async saveBook(book: { id?: string; slug: string; name: string }) {
    const t = this.token();
    if (!t) throw new Error('Brak autoryzacji');

    if (book.id) {
      const res = await fetch(`http://localhost:5200/api/books/${encodeURIComponent(book.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ slug: book.slug, name: book.name }),
      });
      if (!res.ok) throw new Error('Błąd zapisu książki');
      return res.json();
    } else {
      const res = await fetch('http://localhost:5200/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ slug: book.slug, name: book.name }),
      });
      if (!res.ok) throw new Error('Błąd tworzenia książki');
      return res.json();
    }
  }

  async deletePage(slug: string, pageNumber: string | number) {
    const t = this.token();
    if (!t) throw new Error('Brak autoryzacji');
    const res = await fetch(
      `http://localhost:5200/api/admin/books/${encodeURIComponent(slug)}/pages/${encodeURIComponent(
        String(pageNumber)
      )}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${t}` },
      }
    );
    if (!res.ok) throw new Error('Błąd usuwania strony');
    return res.json();
  }

  async normalizeSrc(dryRun = false) {
    const t = this.token();
    if (!t) throw new Error('Brak autoryzacji');
    const res = await fetch('http://localhost:5200/api/admin/normalize-src', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({ dryRun }),
    });
    if (!res.ok) throw new Error('Błąd normalizacji');
    return res.json();
  }
}
