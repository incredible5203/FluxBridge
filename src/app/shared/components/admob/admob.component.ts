import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
  Input,
  OnChanges,
  PLATFORM_ID,
  SimpleChanges
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HeaderStore } from '@app/core/header/services/header.store';

let adsenseScriptPromise: Promise<void> | null = null;

function ensureAdsenseScript(client: string): Promise<void> {
  if (!client) {
    return Promise.reject(new Error('Missing AdSense client'));
  }
  if (typeof document === 'undefined') {
    return Promise.resolve();
  }
  if (adsenseScriptPromise) {
    return adsenseScriptPromise;
  }

  adsenseScriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('adsbygoogle-js') as HTMLScriptElement | null;
    if (existing) {
      if ((window as Window & { adsbygoogle?: unknown[] }).adsbygoogle) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('AdSense script failed')), {
        once: true
      });
      return;
    }

    const script = document.createElement('script');
    script.id = 'adsbygoogle-js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
      client
    )}`;
    script.onload = () => resolve();
    script.onerror = () => {
      adsenseScriptPromise = null;
      reject(new Error('AdSense script failed'));
    };
    document.head.appendChild(script);
  });

  return adsenseScriptPromise;
}

@Component({
  selector: 'app-admob',
  templateUrl: './admob.component.html',
  styleUrls: ['./admob.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdmobComponent implements AfterViewInit, OnChanges {
  @Input() public adClient = process.env.AD_CLIENT || '';

  @Input() public adSlot = process.env.AD_SLOT || '';

  private readonly isBrowser: boolean;

  private hasRenderedSlotAd = false;

  private hasInitializedAutoAds = false;

  constructor(
    private readonly headerStore: HeaderStore,
    private readonly changeDetectorRef: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  public get isMobile(): boolean {
    return this.headerStore.isMobile;
  }

  public ngAfterViewInit(): void {
    this.initializeAds();
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['adSlot']) {
      this.hasRenderedSlotAd = false;
    }

    this.initializeAds();
  }

  private initializeAds(): void {
    if (!this.isBrowser || !this.isMobile || !this.adClient) {
      return;
    }

    void ensureAdsenseScript(this.adClient)
      .then(() => this.runAdsAfterScriptReady())
      .catch(() => {
        this.hasRenderedSlotAd = false;
        this.hasInitializedAutoAds = false;
      })
      .finally(() => this.changeDetectorRef.markForCheck());
  }

  private runAdsAfterScriptReady(): void {
    const adsQueue = ((window as Window & { adsbygoogle?: unknown[] }).adsbygoogle ||= []);

    if (this.adSlot) {
      if (this.hasRenderedSlotAd) {
        return;
      }

      setTimeout(() => {
        try {
          adsQueue.push({});
          this.hasRenderedSlotAd = true;
        } catch {
          this.hasRenderedSlotAd = false;
        }
        this.changeDetectorRef.markForCheck();
      }, 0);
      return;
    }

    if (this.hasInitializedAutoAds) {
      return;
    }

    adsQueue.push({
      enable_page_level_ads: true,
      google_ad_client: this.adClient
    });
    this.hasInitializedAutoAds = true;
  }
}
