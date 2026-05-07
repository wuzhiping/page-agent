<template>
  <div class="div_class_buttons">
    <button
      v-if="voice"
      @click="record"
      :disable="disableSentBtn"
      style="background: none; border: none; cursor: pointer"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        height="36"
        viewBox="0 0 24 24"
        width="36"
      >
        <path
          fill="#FFFFFF"
          d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"
        />
        <path
          fill="#FFFFFF"
          d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
        />
        <path
          fill="#FFFFFF"
          d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"
        />
      </svg>
    </button>
    <button
      v-else
      @click="stop"
      style="background: none; border: none; cursor: pointer"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        height="36"
        viewBox="0 0 24 24"
        width="36"
      >
        <!-- 麦克风主体 -->
        <path
          fill="#22C55E"
          d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 12 3z"
        />
        <!-- 麦克风支架 -->
        <path
          fill="#22C55E"
          d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
        />
      </svg>
    </button>
  </div>
</template>
<script>
import "./js/yysb.js";
export default {
  props: {
    Uri: {
      type: String,
      default: "wss://abc.feg.com.tw/ASR/",
    },
    hotwords: {
      type: String,
      default: "阿里巴巴 20\nhello world 40",
    },
    disableSentBtn: {
      type: Boolean,
      default: false,
    },
  },
  components: {},
  data() {
    return {
      //Uri: "wss://abc.feg.com.tw/ASR/", // 用于存储websocket地址
      asrMode: "2pass", // 用于存储asr模型模式
      request: {
        chunk_interval: 10, // 每隔10毫秒分割一次语音数据
        wav_name: "h5", // 音频流的标识
        chunk_size: [5, 10, 5], // 语音数据分块的大小和格式
        //hotwords: "阿里巴巴 20\nhello world 40", // 热词设置
        is_speaking: true, // 是否正在说话
        mode: "2pass", // 选择的asr模型模式
        itn: false, // 是否使用逆文本标准化
      },
      wsconnecter: "", // socket实例
      rec: "", // 录音；定义录音对象
      sampleBuf: "", // 用于存储音频数据的采样值
      offline_text: "", // 离线语音识别结果
      rec_text: "", // 语音识别结果
      file_data_array: "", // 用于保存音频文件的数据
      totalsend: "", // 用于追踪文件或数据的发送进度
      localport: "", // 获取当前页面中的端口号
      isRec: "", // 判断是否正在录音
      voice: true,
    };
  },
  methods: {
    // websocket连接
    WebSocketConnectMethod() {
      // 分别用于处理消息和连接状态的变化
      // var msgHandle = config.msgHandle;
      // var stateHandle = config.stateHandle;
      // 该方法用于启动 WebSocket 连接。
      // this.Uri = document.getElementById("wssip").value; //"wss://111.205.137.58:5821/wss/" //设置wss asr online接口地址 如 wss://X.X.X.X:port/wss/

      if ("WebSocket" in window) {
        this.wsconnecter = new WebSocket(this.Uri); // 定义socket连接对象
        // 在 WebSocket 连接成功后，发送一些初始化的 JSON 请求数据到服务器（如音频参数、热词等）。这段代码还处理了音频格式和采样率等特定于音频流的设置。
        this.wsconnecter.onopen = () => {
          // 发送json
          // var request = {
          //   chunk_size: chunk_size,
          //   wav_name: "h5",
          //   is_speaking: true,
          //   chunk_interval: 10,
          //   itn: this.getUseITN(),
          //   mode: this.getAsrMode(),
          // };
          var request = JSON.parse(JSON.stringify(this.request));
          request.hotwords = this.hotwords;

          // var hotwords = this.getHotwords();

          // if (hotwords != null) {
          //   request.hotwords = hotwords;
          // }
          console.log(request);
          // let res = {
          //   chunk_interval: 10, // 每隔10毫秒分割一次语音数据
          //   chunk_size: [5, 10, 5], // 语音数据分块的大小和格式
          //   hotwords: '{"阿里巴巴":20,"hello world":40}', // 热词设置
          //   is_speaking: true, // 是否正在说话
          //   itn: false, // 是否使用逆文本标准化
          //   mode: "2pass", // 选择的asr模型模式
          //   wav_name: "h5", // 音频流的标识
          // };
          this.wsconnecter.send(JSON.stringify(request));
          console.log("连接成功");
        };
        // 连接关闭时
        this.wsconnecter.onclose = (e) => {
          console.log("onclose ws!");
          //speechSokt.close();
          // 连接状态变化
        };
        // 处理服务器发回的消息
        this.wsconnecter.onmessage = (e) => {
          // 消息的变化
          this.getJsonMessage(e);
        };
        // 处理 WebSocket 连接错误
        this.wsconnecter.onerror = (e) => {
          console.log(e);
          // 连接状态变化
        };
        return 1;
      } else {
        return 0;
      }
    },
    // 用来关闭 WebSocket 连接。
    wsStop() {
      if (this.wsconnecter != undefined) {
        console.log("stop ws!");
        this.wsconnecter.close();
      }
    },
    // 发送数据到 WebSocket 服务器。
    wsSend(oneData) {
      if (this.wsconnecter == undefined) return;
      if (this.wsconnecter.readyState === 1) {
        // 0:CONNECTING, 1:OPEN, 2:CLOSING, 3:CLOSED
        this.wsconnecter.send(oneData);
      }
    },
    // 用于离线识别文本
    handleWithTimestamp(tmptext) {
      // 从音频中转录出来的文本
      console.log("tmptext: " + tmptext);
      if (tmptext.length <= 0) {
        return tmptext;
      }
      tmptext = tmptext.replace(/。|？|，|、|\?|\.|\ /g, ","); // in case there are a lot of "。"
      var words = tmptext.split(","); // split to chinese sentence or english words
      var text_result = ""; // 用来存储生成的文本的字符串。

      for (var i = 0; i < words.length; i++) {
        if (words[i] == "undefined" || words[i].length <= 0) {
          continue;
        }
        console.log("words===", words[i]);

        text_result = text_result + words[i]; // 直接连接，不加换行符
        // 注意：原代码中的 char_index 和 jsontime 相关逻辑已完全移除
      }
      return text_result; // 返回连续文本，没有换行
    },
    // 语音识别结果; 对jsonMsg数据解析,将识别结果附加到编辑框中
    // 解析 ASR 服务返回的识别文本。
    // 将实时或离线识别文本显示在网页上的文本框中。
    // 在特定条件下（如文件模式并且识别完成时），停止识别过程并播放文件。
    getJsonMessage(jsonMsg) {
      //console.log(jsonMsg);
      console.log("message: " + JSON.parse(jsonMsg.data)["text"]);
      // 识别的文本信息
      var rectxt = "" + JSON.parse(jsonMsg.data)["text"];
      // asr模型模式类型
      var asrmodel = JSON.parse(jsonMsg.data)["mode"];
      console.log("asrmodel", asrmodel);
      // 如果 ASR 模型是 "2pass-offline" 或 "offline"，那么进入此条件块，处理离线识别模式的文本。
      if (asrmodel == "2pass-offline" || asrmodel == "offline") {
        // offline_text 变量是累积的离线识别文本，将当前的 rectxt 和时间戳通过 handleWithTimestamp 函数进行处理后，添加到 offline_text 中。
        this.offline_text =
          this.offline_text + this.handleWithTimestamp(rectxt); //rectxt; //.replace(/ +/g,"");
        this.rec_text = this.offline_text;
        this.$emit("recordText", this.rec_text);
      } else {
        // 如果 ASR 模型不是离线模式，那么rectxt 就会被追加到 rec_text 中，表示当前的实时识别文本。
        console.log("语音识别1", this.rec_text);
        console.log("语音识别2", rectxt);
        this.rec_text = this.rec_text + rectxt; //.replace(/ +/g,"");
        this.$emit("recordText", this.rec_text);
      }
    },

    // 开始按钮
    record() {
      // 清除之前的音频数据
      this.sampleBuf = new Int16Array();
      // 清除之前的识别结果
      this.rec_text = "";
      this.offline_text = "";
      this.start();
      this.rec.open(() => {
        this.rec.start();
        console.log("开始");
        this.voice = false;
      });
    },
    // 连接按钮
    // 识别启动、停止、清空操作
    start() {
      //控件状态更新

      //启动连接
      var ret = this.WebSocketConnectMethod();
      // 1 is ok, 0 is error
      if (ret == 1) {
        this.isRec = true;

        return 1;
      } else {
        return 0;
      }
    },
    // 停止按钮
    stop() {
      var chunk_size = new Array(5, 10, 5);
      var request = {
        chunk_size: chunk_size,
        wav_name: "h5",
        is_speaking: false,
        chunk_interval: 10,
        mode: this.asrMode,
      };
      console.log(request);
      if (this.sampleBuf.length > 0) {
        this.wsSend(this.sampleBuf);
        console.log("sampleBuf.length" + this.sampleBuf.length);
        this.sampleBuf = new Int16Array();
      }
      this.wsSend(JSON.stringify(request));

      // 控件状态更新

      this.isRec = false;

      //wait 3s for asr result
      setTimeout(() => {
        console.log("call stop ws!");
        this.wsStop();
      }, 3000);

      this.rec.stop(
        (blob, duration) => {
          console.log(blob);
          var audioBlob = Recorder.pcm2wav(
            { sampleRate: 16000, bitRate: 16, blob: blob },
            (theblob, duration) => {
              console.log(theblob);
              // var audio_record = this.$refs.audio_record;
              // audio_record.src = (window.URL || webkitURL).createObjectURL(
              //   theblob,
              // );
              // audio_record.controls = true;
              //audio_record.play();
            },
            function (msg) {
              console.log(msg);
            },
          );
        },
        function (errMsg) {
          console.log("errMsg: " + errMsg);
        },
        true,
      );
      this.voice = true;
      // 停止连接
    },
    // 实时地将录音数据分割成指定大小的数据块，并通过 WebSocket 发送这些数据块。
    // 1、将音频数据的采样率从 bufferSampleRate 转换为 16kHz。
    // 2、将转换后的数据添加到一个全局音频缓冲区 sampleBuf 中。
    // 3、将音频数据按固定大小（这里是 960 字节）切分成多个块。
    // 4、使用 WebSocket 将每个数据块发送到服务器。
    recProcess(
      buffer,
      powerLevel,
      bufferDuration,
      bufferSampleRate,
      newBufferIdx,
      asyncEnd,
    ) {
      // 判断是否正在录音
      if (this.isRec === true) {
        // 提取音频数据并进行采样转换
        var data_48k = buffer[buffer.length - 1];
        var array_48k = new Array(data_48k);
        var data_16k = Recorder.SampleData(
          array_48k,
          bufferSampleRate,
          16000,
        ).data;
        // 更新音频缓冲区
        this.sampleBuf = Int16Array.from([...this.sampleBuf, ...data_16k]);
        // 分割并发送音频数据块
        var chunk_size = 960; // for asr chunk_size [5, 10, 5] // 表示每次发送的音频数据块大小。
        // 更新音频时长显示
        // 检查 sampleBuf 是否有足够的数据来分割成一个数据块。如果有，进入循环：
        while (this.sampleBuf.length >= chunk_size) {
          let sendBuf = this.sampleBuf.slice(0, chunk_size); // 从 sampleBuf 中获取前 960 个样本。
          this.sampleBuf = this.sampleBuf.slice(
            chunk_size,
            this.sampleBuf.length,
          ); // 将已发送的数据块从 sampleBuf 中移除，保留剩余部分。
          this.wsSend(sendBuf); // 调用 wsSend(sendBuf) 通过 WebSocket 发送该数据块。
        }
      }
    },
  },
  mounted() {
    // 录音; 定义录音对象,wav格式
    let recProcess = this.recProcess;
    this.rec = Recorder({
      type: "pcm",
      bitRate: 16,
      sampleRate: 16000,
      onProcess: recProcess,
    });
    console.log("录音机", this.rec);
    // 用于存储音频数据的采样值
    this.sampleBuf = new Int16Array();
    // 语音识别结果
    this.rec_text = ""; // for online rec asr result
    //  用于追踪文件或数据的发送进度
    this.totalsend = 0;
  },
  expose: ["record", "stop"],
};
</script>
<style scoped></style>
