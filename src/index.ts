const { random } = require('user-agents');
const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const fs = require('fs');
const { Worker, workerData, isMainThread } = require('worker_threads');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const config = require('../inputs/config.ts');
const csvWriter = createCsvWriter({
  path: './result.csv',
  header: [
    { id: 'email', title: 'Email' },
    { id: 'proxy', title: 'Proxy' },
    { id: 'address', title: 'Address' },
  ],
  append: true,
});

function delay(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}
const numThreads = config.numThreads;
const customDelay = config.customDelay;

function parseAddresses(filePath: string) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const addresses: string[] = [];

  lines.forEach((line: string) => {
    const address = line.trim();
    addresses.push(address);
  });

  return addresses;
}
function parseProxies(filePath: string) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const proxies: string[] = [];

  lines.forEach((line: string) => {
    const proxy = line.trim();
    proxies.push(proxy);
  });

  return proxies;
}

const addresses = parseAddresses('./inputs/addresses.txt');
const proxies = parseProxies('./inputs/proxies.txt');
const emails = parseProxies('./inputs/emails.txt');

async function reg(address: any, email: string, proxy: string) {
  const headers = {
    Host: 'etherfi-turbo-etherfi-app.vercel.app',
    'User-Agent': random().toString(),
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US;q=0.5,en;q=0.3',
    'Content-Type': 'application/json',
    Referer: 'https://etherfi-turbo-etherfi-app.vercel.app/',
    Origin: 'https://etherfi-turbo-etherfi-app.vercel.app',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'cross-site',
  };
  const session = axios.create({
    headers: headers,
    httpsAgent:
      config.proxyType === 'http' ? new HttpsProxyAgent(`http://${proxy}`) : new SocksProxyAgent(`socks5://${proxy}`),
  });

  const data = { email: email, goerli: true, mainnet: true, account: address };
  console.log('data: ', data);
  const res = await session.post('https://etherfi-turbo-etherfi-app.vercel.app/api/whitelist', data);
  console.log('response: ', res.data);

  const resultData = [
    {
      email: email,
      proxy: proxy,
      address: address,
    },
  ];
  await csvWriter
    .writeRecords(resultData)
    .then(() => {
      console.log('CSV file has been saved.');
    })
    .catch((error: any) => {
      console.error(error);
    });
}

function regRecursive(addresses: any, proxies: any, emails: any, index = 0, numThreads = 4) {
  if (index >= addresses.length) {
    return;
  }

  const worker = new Worker(__filename, {
    workerData: { address: addresses[index], proxy: proxies[index], email: emails[index] },
  });
  worker.on('message', (message: any) => {
    console.log(message);
  });
  worker.on('error', (error: any) => {
    console.error(error);
  });
  worker.on('exit', (code: any) => {
    if (code !== 0) {
      console.error(`Thread Exit ${code}`);
    }
    regRecursive(addresses, proxies, emails, index + numThreads, numThreads);
  });
}
const main = async () => {
  if (isMainThread) {
    for (let i = 0; i < numThreads; i++) {
      await delay(customDelay);
      regRecursive(addresses, proxies, emails, i, numThreads);
    }
  } else {
    await delay(customDelay);
    const { address, email, proxy } = workerData;
    reg(address, email, proxy);
  }
};
main();
