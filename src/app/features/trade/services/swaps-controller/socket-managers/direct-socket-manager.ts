import { switchMap } from 'rxjs';
import { ApiSocketManager } from './socket-manager';
import { SwapsControllerService } from '@app/features/trade/services/swaps-controller/swaps-controller.service';
import { RubicApiService } from '@app/core/services/sdk/sdk-legacy/rubic-api/rubic-api.service';

/**
 * WebSocket lifecycle without Cloudflare / Turnstile: quotes run as soon as the socket connects.
 */
export class DirectSocketManager extends ApiSocketManager {
  constructor(rubicApiService: RubicApiService, swapsControllerService: SwapsControllerService) {
    super(rubicApiService, swapsControllerService);
  }

  public allowCalculation(): boolean {
    return true;
  }

  public initSubs(): void {
    const connSub = this.rubicApiService
      .handleSocketConnected()
      .pipe(switchMap(() => this.rubicApiService.refreshCloudflareToken(true)))
      .subscribe(() => {
        this.swapsControllerService.handleWs();
      });
    this.subs.push(connSub);
  }
}
