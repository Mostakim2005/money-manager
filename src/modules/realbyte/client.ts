/**
 * Client for Realbyte Money Manager's built-in PC Manager HTTP server.
 * When enabled on the Android phone over Wi-Fi, the app listens on port 10000.
 */
export class RealbytePcManagerClient {
  private baseUrl: string;

  constructor(phoneIp: string, port: number = 10000) {
    this.baseUrl = `http://${phoneIp}:${port}/moneyBook`;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Health check to verify connection to the phone's PC Manager server.
   */
  public async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/`, { method: 'GET' });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fetches account definitions from Realbyte PC Manager.
   */
  public async fetchAccounts(): Promise<unknown[]> {
    const response = await fetch(`${this.baseUrl}/account/select.do`);
    if (!response.ok) throw new Error(`Failed to fetch accounts: ${response.statusText}`);
    return await response.json();
  }

  /**
   * Fetches category definitions from Realbyte PC Manager.
   */
  public async fetchCategories(): Promise<unknown[]> {
    const response = await fetch(`${this.baseUrl}/category/select.do`);
    if (!response.ok) throw new Error(`Failed to fetch categories: ${response.statusText}`);
    return await response.json();
  }

  /**
   * Fetches income and expense transactions for a specific date range.
   */
  public async fetchTransactions(startDate: string, endDate: string): Promise<unknown[]> {
    const response = await fetch(`${this.baseUrl}/ledger/select.do?start=${startDate}&end=${endDate}`);
    if (!response.ok) throw new Error(`Failed to fetch transactions: ${response.statusText}`);
    return await response.json();
  }
}
