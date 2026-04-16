import { Injectable } from '@angular/core';
import { catchError, map, Observable, of, shareReplay, startWith, switchMap, timer } from 'rxjs';
import { ApiBanner } from '../models/banners';
import { HttpService } from '@app/core/services/http/http.service';
import { shareReplayConfig } from '@app/shared/constants/common/share-replay-config';

// refetch banners every 10 minutes
const REFETCH_AFTER = 60 * 10 * 1_000;

const DEFAULT_BANNERS: ApiBanner[] = [
  {
    text: '<b style="color: #00e28d">0 Fees</b> On FluxBridge For Swaps Below 100$!',
    textMobile:
      '<b style="color: #00e28d">0 Fees</b> <b>On FluxBridge</b><br>For Swaps Below 100$!',
    buttonText: '<b>Learn More<b/>',
    linkUrl: 'https://fluxbridge.cc/?fromChain=ARBITRUM&toChain=ETH&from=USDC&to=ETH&amount=90',
    imageUrlDesktop: 'assets/banner/zero-fees-bg.png',
    imageUrlMobile: 'assets/banner/zero-fees-mobile.png'
  }
];

@Injectable()
export class BannersService {
  private hasOnlyAllowedLinks(html: string): boolean {
    if (!html) return true;

    const TARGET = 'https://app.rubic.exchange';

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const links = doc.querySelectorAll('a');

    return Array.from(links).every(link => {
      const href = link.getAttribute('href') || '';
      return href.startsWith(TARGET);
    });
  }

  private transformBannerHtml(html: string): string {
    if (!html) return html;

    const APP = 'https://app.rubic.exchange';
    // const LOCAL = 'https://local.rubic.exchange:4224';
    const LOCAL = 'https://fluxbridge.cc';

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 1. Fix links
    doc.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href') || '';

      // convert app links
      if (href.startsWith(APP)) {
        a.setAttribute('href', href.replace(APP, LOCAL));
      }

      // optional: remove/skip external blog links OR leave them unchanged
      if (href.includes('rubic.exchange/blog')) {
        // keep as-is OR you can strip target if needed
        a.setAttribute('target', '_blank');
      }
    });

    // 2. Fix inline styles
    doc.querySelectorAll('[style]').forEach(el => {
      const style = el.getAttribute('style') || '';
      el.setAttribute('style', style.replace(/color:\s*#00e28d/gi, 'color: #6367f1'));
    });

    // 3. Replace plain text "Rubic" -> "FluxBridge" safely (NOT HTML tags)
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);

    const textNodes: Text[] = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode as Text);
    }

    textNodes.forEach(node => {
      node.nodeValue = node.nodeValue?.replace(/Rubic/gi, 'FluxBridge') || '';
    });

    return doc.body.innerHTML;
  }

  private transformLinkUrl(url: string): string {
    if (!url) return url;

    const APP = 'https://app.rubic.exchange';
    // const LOCAL = 'https://local.rubic.exchange:4224';
    const LOCAL = 'https://fluxbridge.cc';

    return url.startsWith(APP) ? url.replace(APP, LOCAL) : url;
  }

  public readonly banners$: Observable<ApiBanner[]> = timer(0, REFETCH_AFTER).pipe(
    switchMap(() =>
      this.httpService
        .get<ApiBanner[]>('v2/info/banners', {}, '', { retry: 2 })
        .pipe(catchError(() => of(DEFAULT_BANNERS)))
    ),
    map(banners => {
      const source = banners.length ? banners : DEFAULT_BANNERS;

      const filtered = source.filter(
        b =>
          b.linkUrl.includes('https://app.rubic.exchange') &&
          this.hasOnlyAllowedLinks(b.text) &&
          this.hasOnlyAllowedLinks(b.textMobile)
      );

      return filtered.length
        ? filtered.map(b => ({
            ...b,
            linkUrl: this.transformLinkUrl(b.linkUrl),
            text: this.transformBannerHtml(b.text),
            textMobile: this.transformBannerHtml(b.textMobile)
          }))
        : [];
    }),
    // map(banners =>
    //   (banners.length ? banners : DEFAULT_BANNERS)
    //     .filter(
    //       banner => banner.linkUrl.includes('https://app.rubic.exchange') // ✅ keep only matching
    //     )
    //     .map(banner => ({
    //       ...banner,
    //       linkUrl: banner.linkUrl.replace(
    //         'https://app.rubic.exchange',
    //         'https://local.rubic.exchange:4224'
    //       ),
    //       text: banner.text.replace(/rubic/gi, 'FluxBridge'),
    //       textMobile: banner.textMobile.replace(/rubic/gi, 'FluxBridge')
    //     }))
    // ),
    shareReplay(shareReplayConfig),
    startWith([])
  );

  constructor(private readonly httpService: HttpService) {}
}
