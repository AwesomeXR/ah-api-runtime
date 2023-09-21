export type IApiRequest = {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: any;
};

export type IApiResponse = {
  status: number;
  statusText: string;
  json: () => Promise<any>;
};

export type IApiConfig = {
  skipErrorHandler?: boolean;
};

export class BaseService {
  /** @overwrite */
  static replaceUrlParams(ctx: BaseService, url: string, data?: any) {
    if (!data) return url;

    const match = url.match(/\:\w+/g);
    if (match) {
      const pnSet = new Set(match.map(p => p.replace(/^\:/, '')));
      pnSet.forEach(p => {
        url = url.replace(new RegExp(`\:${p}`, 'g'), data[p]);
      });
    }

    return url;
  }

  /** @overwrite */
  static omitUndefined<T extends Record<string, any>>(ctx: BaseService, data: T): Partial<T> {
    const re: any = {};

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'undefined') continue;
      re[key] = value;
    }

    return re;
  }

  /** @overwrite */
  static stringifyQuery(ctx: BaseService, query: Record<string, string>): string {
    return new URLSearchParams(query).toString();
  }

  /** @overwrite */
  static getBaseURL(ctx: BaseService): string {
    return '';
  }

  /** @overwrite */
  static getHeaders(ctx: BaseService): Record<string, string> {
    return {};
  }

  /** @overwrite */
  static handleError(ctx: BaseService, message: string, status: number, err: any) {}

  static async handleFetch(ctx: BaseService, req: IApiRequest): Promise<IApiResponse> {
    return fetch(req.url, req);
  }

  async _request<T>(path: string, method: string, query: any = {}, config: IApiConfig = {}): Promise<T> {
    query = BaseService.omitUndefined(this, query);
    path = BaseService.replaceUrlParams(this, path, query);

    const isGet = method.toUpperCase() === 'GET';
    const url = BaseService.getBaseURL(this) + path + (isGet ? '?' + BaseService.stringifyQuery(this, query) : '');

    try {
      const req: IApiRequest = {
        url,
        method,
        headers: { 'content-type': 'application/json', ...BaseService.getHeaders(this) },
        body: isGet ? undefined : JSON.stringify(query),
      };
      const rsp = await BaseService.handleFetch(this, req);

      const statusType = Math.floor(rsp.status / 100);
      if (statusType === 5) throw Object.assign(new Error('系统异常'), { status: rsp.status });

      const data = await rsp.json();

      if (statusType !== 2) {
        throw Object.assign(new Error(data.message || rsp.statusText), { status: rsp.status, response: data });
      }

      return data;
    } catch (_err) {
      if (!config.skipErrorHandler) {
        const message = (_err as any).message || _err + '';
        const status = (_err as any).status || -1;

        BaseService.handleError(this, message, status, _err);
      }

      throw _err;
    }
  }
}
