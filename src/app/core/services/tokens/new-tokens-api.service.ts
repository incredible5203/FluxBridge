import { Injectable } from '@angular/core';
import {
  BackendBalanceToken,
  BackendToken,
  ENDPOINTS,
  FavoriteTokenRequestParams,
  RatedBackendToken,
  TokensBackendResponse
} from '@core/services/backend/tokens-api/models/tokens';
import { RatedToken, Token } from '@shared/models/tokens/token';
import { Cache as Memo, Token as OldToken } from '@cryptorubic/core';
import {
  BackendBlockchain,
  BLOCKCHAIN_NAME,
  FROM_BACKEND_BLOCKCHAINS,
  TO_BACKEND_BLOCKCHAINS,
  TEST_EVM_BLOCKCHAIN_NAME,
  BlockchainName
} from '@cryptorubic/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { HttpService } from '@core/services/http/http.service';
import { ENVIRONMENT } from '../../../../environments/environment';
import { BalanceToken } from '@shared/models/tokens/balance-token';
import { AuthService } from '@core/services/auth/auth.service';
import { RubicAny } from '@shared/models/utility-types/rubic-any';
import { DISABLED_BLOCKCHAINS_MAP } from '@app/features/trade/components/assets-selector/services/blockchains-list-service/constants/disabled-from-blockchains';

export type QueryTokenParams =
  | {
      query: string;
      blockchain: BlockchainName | null;
    }
  | {
      symbol: string;
      blockchain: BlockchainName | null;
    };

@Injectable({
  providedIn: 'root'
})
export class NewTokensApiService {
  private readonly tokensApiUrl = `${ENVIRONMENT.apiTokenUrl}/`;

  private readonly pageSize = 50;

  private readonly topTierChains: BlockchainName[] = [
    BLOCKCHAIN_NAME.ETHEREUM,
    BLOCKCHAIN_NAME.ARBITRUM,
    BLOCKCHAIN_NAME.POLYGON,
    BLOCKCHAIN_NAME.BINANCE_SMART_CHAIN,
    BLOCKCHAIN_NAME.BASE,
    BLOCKCHAIN_NAME.SOLANA,
    BLOCKCHAIN_NAME.BERACHAIN,
    BLOCKCHAIN_NAME.ZK_SYNC,
    BLOCKCHAIN_NAME.OPTIMISM,
    BLOCKCHAIN_NAME.BITCOIN
  ];

  constructor(
    private readonly httpService: HttpService,
    private readonly authService: AuthService
  ) {}

  public fetchQueryTokens(params: QueryTokenParams): Observable<Token[]> {
    const options = {
      ...('query' in params && { query: params.query }),
      ...('symbol' in params && { symbol: params.symbol }),
      ...(params.blockchain !== null && { network: TO_BACKEND_BLOCKCHAINS[params.blockchain] })
    };

    return this.httpService.get<TokensBackendResponse>(ENDPOINTS.TOKENS, options).pipe(
      catchError(() => {
        return of({
          count: 0,
          next: '0',
          previous: '0',
          results: [] as BackendToken[]
        });
      }),
      map(tokensResponse =>
        tokensResponse.results.length
          ? NewTokensApiService.prepareTokens(tokensResponse.results)
          : []
      )
    );
  }

  public static prepareTokens<T extends BackendToken = BackendToken, K extends Token = Token>(
    tokens: T[]
  ): K[] {
    const tokenModel = tokens.map((token: T) => {
      // @TODO Back bug, fix after
      const backendBlockchain = (FROM_BACKEND_BLOCKCHAINS[
        token.blockchainNetwork as BackendBlockchain
      ] || (token as RubicAny)?.network) as BackendBlockchain;
      // @ts-ignore
      return {
        blockchain: backendBlockchain,
        address: token.address,
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals,
        image: token.image,
        rank: token.rank,
        price: token.usdPrice,
        tokenSecurity: token.token_security,
        networkRank: token.networkRank || 1,
        type: token.type,
        ...('source_rank' in token && { sourceRank: token.source_rank }),
        ...('usdPriceChangePercentage24h' in token && {
          priceChange24h: token.usdPriceChangePercentage24h
        }),
        ...('usdPriceChangePercentage7d' in token && {
          priceChange7d: token.usdPriceChangePercentage7d
        }),
        ...('balance' in token && { amount: OldToken.fromWei(token.balance, token.decimals) })
      } as K;
    });
    return tokenModel.filter(
      token => token.address && token.blockchain && !DISABLED_BLOCKCHAINS_MAP[token.blockchain]
    );
  }

  public getNewPage(
    page: number,
    chain: BlockchainName,
    pageSize = this.pageSize
  ): Observable<{ list: Token[]; total: number; haveMore: boolean }> {
    const options = { page: page, pageSize };

    return this.httpService
      .get<TokensBackendResponse>(
        ENDPOINTS.TOKENS,
        { ...options, network: chain },
        this.tokensApiUrl
      )
      .pipe(
        map(backendResponse => {
          return {
            list: NewTokensApiService.prepareTokens(backendResponse.results),
            total: backendResponse.count,
            haveMore: Boolean(backendResponse.next)
          };
        })
      );
  }

  @Memo({ maxAge: 60 * 60 * 1_000 })
  public getTopTokens(
    chainsList = this.topTierChains
  ): Observable<
    Partial<Record<BlockchainName, { list: Token[]; total: number; haveMore: boolean }>>
  > {
    return forkJoin(
      chainsList.map(chain =>
        this.httpService
          .get<TokensBackendResponse>(
            ENDPOINTS.TOKENS,
            { network: chain, pageSize: this.pageSize },
            this.tokensApiUrl,
            { retry: 2, timeoutMs: 15_000, external: true }
          )
          .pipe(
            catchError(() =>
              of<TokensBackendResponse>({
                count: 0,
                next: null,
                previous: null,
                results: []
              })
            )
          )
      )
    ).pipe(
      map((responses: TokensBackendResponse[]) =>
        chainsList.reduce((acc, chain, idx) => {
          const backendResponse = responses[idx];
          if (!backendResponse) {
            return acc;
          }
          return {
            ...acc,
            [chain]: {
              list: NewTokensApiService.prepareTokens(backendResponse.results),
              total: backendResponse.count,
              haveMore: Boolean(backendResponse.next)
            }
          };
        }, {} as Partial<Record<BlockchainName, { list: Token[]; total: number; haveMore: boolean }>>)
      )
    );
  }

  @Memo({ maxAge: 60 * 60 * 1_000 })
  public getRestTokens(): Observable<
    Partial<Record<BlockchainName, { list: Token[]; total: number; haveMore: boolean }>>
  > {
    const excludedChains = [...Object.values(TEST_EVM_BLOCKCHAIN_NAME), ...this.topTierChains];
    const tier2blockchains = Object.values(BLOCKCHAIN_NAME).filter(
      chain => !excludedChains.includes(chain)
    );

    return forkJoin(
      tier2blockchains.map(chain =>
        this.httpService
          .get<TokensBackendResponse>(
            ENDPOINTS.TOKENS,
            { network: chain, pageSize: this.pageSize },
            this.tokensApiUrl,
            { retry: 2, timeoutMs: 15_000, external: true }
          )
          .pipe(
            catchError(() =>
              of<TokensBackendResponse>({
                count: 0,
                next: null,
                previous: null,
                results: []
              })
            )
          )
      )
    ).pipe(
      map((responses: TokensBackendResponse[]) =>
        tier2blockchains.reduce((acc, chain, idx) => {
          const backendResponse = responses[idx];
          if (!backendResponse) {
            return acc;
          }
          return {
            ...acc,
            [chain]: {
              list: NewTokensApiService.prepareTokens(backendResponse.results),
              total: backendResponse.count,
              haveMore: Boolean(backendResponse.next)
            }
          };
        }, {} as Partial<Record<BlockchainName, { list: Token[]; total: number; haveMore: boolean }>>)
      )
    );
  }

  public fetchFavoriteTokens(): Observable<Token[]> {
    return this.httpService
      .get<BackendToken[]>(
        ENDPOINTS.FAVORITE_TOKENS,
        { user: this.authService.userAddress },
        this.tokensApiUrl
      )
      .pipe(
        map(resp => NewTokensApiService.prepareTokens<BackendToken, Token>(resp)),
        catchError(() => of([]))
      );
  }

  public addFavoriteToken(token: BalanceToken): Observable<unknown | null> {
    const body: FavoriteTokenRequestParams = {
      network: TO_BACKEND_BLOCKCHAINS[token.blockchain],
      address: token.address,
      user: this.authService.userAddress
    };
    return this.httpService.post(ENDPOINTS.FAVORITE_TOKENS, body, this.tokensApiUrl);
  }

  public deleteFavoriteToken(token: BalanceToken): Observable<unknown | null> {
    const body: FavoriteTokenRequestParams = {
      network: TO_BACKEND_BLOCKCHAINS[token.blockchain],
      address: token.address,
      user: this.authService.userAddress
    };
    return this.httpService.delete(ENDPOINTS.FAVORITE_TOKENS, { body }, this.tokensApiUrl);
  }

  public fetchTrendTokens(): Observable<RatedToken[]> {
    return this.httpService
      .get<RatedBackendToken[]>('v2/tokens/trending', {}, '', { retry: 2, timeoutMs: 15_000 })
      .pipe(
        map(backendTokens =>
          NewTokensApiService.prepareTokens<RatedBackendToken, RatedToken>(backendTokens)
        ),
        catchError(() => of([]))
      );
  }

  public fetchGainersTokens(): Observable<RatedToken[]> {
    return this.httpService
      .get<TokensBackendResponse>('v2/tokens/gainers', {}, '', { retry: 2, timeoutMs: 15_000 })
      .pipe(
        map(resp =>
          NewTokensApiService.prepareTokens<RatedBackendToken, RatedToken>(
            resp.results as RatedBackendToken[]
          )
        ),
        catchError(() => of([]))
      );
  }

  public fetchLosersTokens(): Observable<RatedToken[]> {
    return this.httpService
      .get<TokensBackendResponse>('v2/tokens/losers', {}, '', { retry: 2, timeoutMs: 15_000 })
      .pipe(
        map(resp =>
          NewTokensApiService.prepareTokens<RatedBackendToken, RatedToken>(
            resp.results as RatedBackendToken[]
          )
        ),
        catchError(() => of([]))
      );
  }

  /**
   * Multi-chain portfolio balances were previously served from legacy `v3/tmp/tokens/get_user_token_balances`.
   * There is no documented public v2 replacement on the Django API; callers should rely on per-chain
   * balance reads via `TokensBalanceService` until Rubic exposes an equivalent.
   */
  public getBackendBalances(
    _address: string
  ): Observable<Partial<Record<BlockchainName, BackendBalanceToken[]>> | null> {
    return of(null);
  }

  public getUtilityTokenList(): Observable<{
    gainers: Token[];
    losers: Token[];
    trending: Token[];
  }> {
    return forkJoin({
      trending$: this.fetchTrendTokens(),
      gainers$: this.fetchGainersTokens(),
      losers$: this.fetchLosersTokens()
    }).pipe(
      map(({ trending$, gainers$, losers$ }) => ({
        trending: trending$,
        gainers: gainers$,
        losers: losers$
      })),
      catchError(() =>
        of({
          gainers: [] as Token[],
          losers: [] as Token[],
          trending: [] as Token[]
        })
      )
    );
  }
}
