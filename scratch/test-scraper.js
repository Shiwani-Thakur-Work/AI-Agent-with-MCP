const gplay = require('google-play-scraper').default || require('google-play-scraper');
const appStore = require('app-store-scraper');

async function test() {
  const gp = await gplay.reviews({ appId: 'com.spotify.music', sort: gplay.sort.NEWEST, num: 1 });
  console.log('GP Review:', gp.data[0]);

  const as = await appStore.reviews({ appId: 'com.spotify.client', sort: appStore.sort.RECENT, page: 1 });
  console.log('AS Review:', as[0]);
}
test();
