import * as readline from 'readline';
import { ethers } from 'ethers';
import { Provider, Contract } from 'ethers-multicall';

function clearLine() {
	readline.clearLine(process.stdout, 0);
	readline.cursorTo(process.stdout, 0);
}

const signalABI = [
	"function tokenStake(uint256 tokenId) view returns (uint256)",
	"function exists(uint256 tokenId) view returns (bool)",
	"event TrackedToken(bytes32 cst, address indexed nftAddress, uint256 tokenID, bytes32 geohash, uint256 radius)",
];

const p = new ethers.providers.InfuraProvider('homestead', process.env.INFURA_API);

const sc = new ethers.Contract(
	"0x36f16a0d35b866cdd0f3c3fa39e2ba8f48b099d2",
	signalABI,
	p
);

let j = JSON.parse((new ethers.utils.Interface(signalABI)).format('json') as string);
j[0].outputs = j[0].ouputs; // https://github.com/ethers-io/ethers.js/pull/1245
j[1].outputs = j[1].ouputs;

const msc = new Contract(
	"0x36f16a0d35b866cdd0f3c3fa39e2ba8f48b099d2",
	j,
);

async function main() {
	console.log(`signal token address: ${sc.address}`);
	const lastTrackEv = (await sc.queryFilter(sc.filters.TrackedToken(), 11442213)).reverse()[0];
	if (!lastTrackEv || !lastTrackEv.args) {
		throw new Error('no TrackedToken events found');
	}

	const lastId = lastTrackEv.args['tokenID'].toNumber();
	console.log(`last signal ID: ${lastId}; collecting stake`);
	const ethcallProvider = new Provider(p);
	await ethcallProvider.init();

	const batchSize = 400;
	let stakeSum = ethers.constants.Zero;
	let stakeNum = 0;
	for (let i = 1; i < lastId;) {
		let to = i + batchSize;
		if (to > lastId) { to = lastId; }

		clearLine(); process.stdout.write(`[${i}-${to}/${lastId}] `);

		let calls = [];
		for(let j = i; j < to; j++) {
			calls.push(msc.exists(j));
			calls.push(msc.tokenStake(j));
		}

		let ret = await ethcallProvider.all(calls);

		for (let j = 0; j < ret.length; j += 2) {
			if (!ret[j]) { continue; }
			stakeSum = stakeSum.add(ret[j+1]);
			stakeNum++
		}

			i = to;
	}
	process.stdout.write(`\n`);

	console.log(`${ethers.utils.formatEther(stakeSum)} FOAM staked across ${stakeNum} signals (avg. ${ethers.utils.formatEther(stakeSum.div(stakeNum))} FOAM)`);
}

main()
.then(() => process.exit(0))
.catch(error => {
	console.error(error);
	process.exit(1);
});
