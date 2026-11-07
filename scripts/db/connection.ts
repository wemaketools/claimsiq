/** The one way scripts open a plain Postgres connection: it is closed whatever `work` or the connect does. */
import pg from 'pg';

export async function withClient<R>(url: string, work: (client: pg.Client) => Promise<R>, options: pg.ClientConfig = {}): Promise<R> {
  const client = new pg.Client({ ...options, connectionString: url });
  try {
    await client.connect();
    return await work(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}
