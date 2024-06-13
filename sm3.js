const { Buffer } = require('node:buffer');
const VArr = []

VArr.push([
    0x7380166f, 0x4914b2b9, 0x172442d7, 0xda8a0600,
    0xa96f30bc, 0x163138aa, 0xe38dee4d, 0xb0fb0e4e
])

function moveLeft(a, n) {
    n = n % 32
    return (a << n) | (a >>> (32 - n))
}

function T(i) {
    return i < 16 ? 0x79cc4519 : 0x7a879d8a
}

function FF(i, x, y, z) {
    return i < 16 ? (x ^ y ^ z) : ((x & y) | (x & z) | (y & z))
}

function GG(i, x, y, z) {
    return i < 16 ? (x ^ y ^ z) : ((x & y) | (~x & z))
}

function P0(word) {
    return word ^ moveLeft(word, 9) ^ moveLeft(word, 17)
}

function P1(word) {
    return word ^ moveLeft(word, 15) ^ moveLeft(word, 23)
}

function main(data) {
    if (typeof data === 'string')
        data = Buffer.from(data) 
    else 
        throw new TypeError(`Expected "string" but received "${Object.prototype.toString.call(data)}"`)
    const dataLen = data.length * 8 //字节转比特 长度为字节长度，一个字节=8个比特

    if (dataLen > Math.pow(2, 64)) 
            throw new Error("消息长度不超过2^64")

    data = fill(data)
    
    blockNum = data.length / 64 //64字节 512 /8

    const B = new Array(blockNum) //对填充后的消息分组 512位=8字节 
    for (let i = 0; i < blockNum; i++) {
      B[i] = new Array(16) //为每个组创建空间  每组有512位的空间 以字来划分 一个字占32位 512 / 32 = 16
      for (let j = 0; j < 16; j++) {
        const offset = i * 64 + j * 4
        B[i][j] = data.readUInt32BE(offset)
      }
    }

    // 迭代压缩
    for (i = 0; i < blockNum; i++) {
        oneCompress(B[i], i)
    }

    const hash = Buffer.alloc(32) //todo writeInt32BE
    VArr[VArr.length - 1].forEach((item, index) => hash.writeInt32BE(item, index * 4))
    return hash.toString('hex')
}


function fill(data) {
    const buf1 = Buffer.alloc(1, 0x80) //填充1000 0000 = 1个字节
    const dataLen = data.length
    // console.log(dataLen);
    // 取值 "0" 的 k 比特填充
    let k = data.length % 64 // 64 * 8 === 512
    // todo 不理解
    k = k >= 56 ? 64 - (k % 56) - 1 : 56 - k - 1 // 56 * 8 === 448
    const buf2 = Buffer.alloc(k, 0)
    const buf3 = Buffer.alloc(8) //64位消息长度
    const size = dataLen * 8 // 不超过 2^53-1
    // console.log(size);
    
    // todo 不理解
    buf3.writeUInt32BE(Math.floor(size / 2 ** 32), 0) // 高 32 位
    buf3.writeUInt32BE(size % 2 ** 32, 4) // 低 32 位
    // console.log(buf3);
    //<Buffer 00 00 00 00 00 00 00 18> 18是16进制
    return Buffer.concat([data, buf1, buf2, buf3], data.length + 1 + k + 8)
}


function expand(block) {
    const W = new Array(132)
    // 首先将消息分Bi划分为16个字
    block.forEach((item, index) => {
        W[index] = item
    })

    // 递推生成68个字
    for(let j = 16; j < 68; j++) {
        const p1_parameter = W[j - 16] ^ W[j - 9] ^ moveLeft(W[j - 3], 15)
        W[j] = P1(p1_parameter) ^ moveLeft(W[j - 13], 7) ^ W[j - 6]
    }
    // 递推生成Wj′ 64个
    for (i = 68; i < 132; i++) {
        W[i] = W[i - 68] ^ W[i - 64]
    }
    return W
}

function oneCompress(block, index) {
    const W = expand(block)

    let SS1, SS2, TT1, TT2
    let [A, B, C, D, E, F, G, H] = VArr[index]

    for (let i = 0; i < 64; i++) {
        SS1 =  moveLeft( moveLeft(A, 12) + E + moveLeft(T(i), i), 7 )
        SS2 = SS1 ^ (moveLeft(A, 12))
        TT1 = FF(i, A, B, C) + D + SS2 + W[i + 68]
        TT2 = GG(i, E, F, G) + H + SS1 + W[i]
        D = C
        C = moveLeft(B, 9)
        B = A
        A = TT1
        H = G
        G = moveLeft(F, 19)
        F = E
        E = P0(TT2)
    }

    VArr[index + 1] = 
    [
        A ^ VArr[index][0],
        B ^ VArr[index][1],
        C ^ VArr[index][2],
        D ^ VArr[index][3],
        E ^ VArr[index][4],
        F ^ VArr[index][5],
        G ^ VArr[index][6],
        H ^ VArr[index][7]
    ]

}


const hash = main('abc')
console.log(hash);