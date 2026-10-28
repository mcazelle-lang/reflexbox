import { Component, inject, OnDestroy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ImpactDetector } from '../../core/impact-detector.service';
import { PreferencesService } from '../../core/preferences.service';
import { Preferences } from '../../core/models';

@Component({
  selector: 'app-settings',
  imports: [RouterLink],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class SettingsPage implements OnDestroy {
  private readonly prefsService = inject(PreferencesService);
  protected readonly detector = inject(ImpactDetector);
  protected readonly prefs = this.prefsService.prefs;
  protected readonly testHits = signal(0);
  private unsubscribe: (() => void) | null = null;

  protected toggle(key: keyof Pick<Preferences, 'sounds' | 'voice' | 'mic' | 'showNumbers'>): void {
    this.prefsService.update({ [key]: !this.prefs()[key] });
  }

  protected setStance(stance: Preferences['stance']): void {
    this.prefsService.update({ stance });
  }

  protected setReveal(reveal: Preferences['reveal']): void {
    this.prefsService.update({ reveal });
  }

  protected setSensitivity(event: Event): void {
    const value = +(event.target as HTMLInputElement).value;
    this.prefsService.update({ micSensitivity: value });
    this.detector.setSensitivity(value);
  }

  protected async toggleTest(): Promise<void> {
    if (this.detector.active()) {
      this.stopTest();
      return;
    }
    this.detector.setSensitivity(this.prefs().micSensitivity);
    if (await this.detector.start()) {
      this.testHits.set(0);
      this.unsubscribe = this.detector.onImpact(() => this.testHits.update((n) => n + 1));
    }
  }

  ngOnDestroy(): void {
    this.stopTest();
  }

  private stopTest(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.detector.stop();
  }
}
