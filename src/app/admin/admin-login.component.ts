import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AdminService } from './admin.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="wrap">
      <h2>Panel administratora</h2>
      <form (submit)="onSubmit($event)" class="form">
        <label>
          Login
          <input type="text" [value]="u()" (input)="u.set($any($event.target).value)" />
        </label>
        <label>
          Hasło
          <input type="password" [value]="p()" (input)="p.set($any($event.target).value)" />
        </label>
        <button type="submit">Zaloguj</button>
        <p class="err" *ngIf="err()">{{ err() }}</p>
      </form>
    </div>
  `,
  styles: [
    `
      .wrap {
        max-width: 420px;
        margin: 2rem auto;
        display: grid;
        gap: 1rem;
      }
      .form {
        display: grid;
        gap: 0.75rem;
      }
      input {
        width: 100%;
        padding: 0.6rem 0.8rem;
        border: 1px solid var(--border);
        border-radius: 10px;
        background: var(--surface);
        color: var(--fg);
      }
      button {
        padding: 0.6rem 1rem;
        border-radius: 10px;
        border: 1px solid color-mix(in oklab, var(--accent) 60%, #000);
        background: var(--accent);
        color: #00110c;
        cursor: pointer;
      }
      .err {
        color: var(--danger);
        margin: 0;
      }
    `,
  ],
})
export class AdminLoginComponent {
  private readonly svc = inject(AdminService);
  private readonly router = inject(Router);

  readonly u = signal('');
  readonly p = signal('');
  readonly err = this.svc.error;

  async onSubmit(ev: Event) {
    ev.preventDefault();
    const ok = await this.svc.login(this.u().trim(), this.p());
    if (ok) this.router.navigateByUrl('/admin');
  }
}
