import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AdminService {
  readonly token = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  async login(username: string, password: string) {
    this.error.set(null);
    try {
      const res = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username, password }).toString(),
      });
      if (!res.ok) throw new Error('Błędne dane logowania');
      const data = await res.json();
      this.token.set(data.token);
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
    fetch('http://localhost:4000/api/auth/logout', {
      headers: { Authorization: `Bearer ${t}` },
      method: 'POST',
    });
  }

  async listBooks() {
    const t = this.token();
    if (!t) throw new Error('Brak autoryzacji');
    const res = await fetch('http://localhost:4000/api/admin/books', {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!res.ok) throw new Error('Błąd pobierania');
    return res.json();
  }

  async deleteBook(slug: string) {
    const t = this.token();
    if (!t) throw new Error('Brak autoryzacji');
    const res = await fetch(`http://localhost:4000/api/admin/books/${encodeURIComponent(slug)}`, {
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
    const res = await fetch('http://localhost:4000/api/admin/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}` },
      body: fd,
    });
    if (!res.ok) throw new Error('Błąd uploadu');
    return res.json();
  }

  async upsertPage(
    slug: string,
    page: { id: string; title: string; src: string; kind?: string; password: string }
  ) {
    const t = this.token();
    if (!t) throw new Error('Brak autoryzacji');
    const res = await fetch(
      `http://localhost:4000/api/admin/books/${encodeURIComponent(slug)}/pages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify(page),
      }
    );
    if (!res.ok) throw new Error('Błąd zapisu strony');
    return res.json();
  }

  async saveBook(book: { slug: string; name: string; pages: any[] }) {
    const t = this.token();
    if (!t) throw new Error('Brak autoryzacji');
    // Najpierw spróbuj aktualizacji; jeśli 404, utwórz nową księgę (POST)
    const put = await fetch(
      `http://localhost:4000/api/admin/books/${encodeURIComponent(book.slug)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify(book),
      }
    );
    if (put.status === 404) {
      const post = await fetch('http://localhost:4000/api/admin/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify(book),
      });
      if (!post.ok) throw new Error('Błąd tworzenia książki');
      return post.json();
    }
    if (!put.ok) throw new Error('Błąd zapisu książki');
    return put.json();
  }

  async deletePage(slug: string, id: string) {
    const t = this.token();
    if (!t) throw new Error('Brak autoryzacji');
    const res = await fetch(
      `http://localhost:4000/api/admin/books/${encodeURIComponent(slug)}/pages/${encodeURIComponent(
        id
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
    const res = await fetch('http://localhost:4000/api/admin/normalize-src', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({ dryRun }),
    });
    if (!res.ok) throw new Error('Błąd normalizacji');
    return res.json();
  }
}
