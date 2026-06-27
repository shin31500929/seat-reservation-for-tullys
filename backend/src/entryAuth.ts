import { EntryMethod } from '@prisma/client';

export interface EntryAuthenticator {
  supports(method: EntryMethod): boolean;
  verify(token: string): Promise<boolean>;
}

class QrAuthenticator implements EntryAuthenticator {
  supports(method: EntryMethod): boolean {
    return method === EntryMethod.QR;
  }

  async verify(token: string): Promise<boolean> {
    return token.startsWith('store:');
  }
}

class FutureAuthenticator implements EntryAuthenticator {
  constructor(private readonly method: EntryMethod) {}

  supports(method: EntryMethod): boolean {
    return method === this.method;
  }

  async verify(token: string): Promise<boolean> {
    return token.length > 0;
  }
}

const authenticators: EntryAuthenticator[] = [
  new QrAuthenticator(),
  new FutureAuthenticator(EntryMethod.WIFI),
  new FutureAuthenticator(EntryMethod.GPS),
];

export async function verifyEntry(method: EntryMethod, token: string): Promise<boolean> {
  const authenticator = authenticators.find((x) => x.supports(method));
  if (!authenticator) return false;
  return authenticator.verify(token);
}
