const test = require("tape");
const SyncObject = require("../src");
const { EVT_UPDATED } = SyncObject;

test("sync objects can be linked together", t => {
  t.plan(3);

  const s1 = new SyncObject({
    peers: {
      "e9affe4b-5fac-44f1-aa0e-520d1015d8ad": {
        media: "75496223-07cd-4330-9d38-a8d77439808b",
        name: "Clemens O'Keefe",
        description:
          "🚀  Fourth Generation Agitator 📈 Working on the intersection of Plant Medicines and Psychedelic Research 🤩 Played chess with Harry Styles at the baggage claim at LAX once 🗣 Reddit/Crypto/Energy Healing 💪 Building major partnerships that drive resentment",
        detectedDevice: {},
        deviceAddress: "0x296f636B0878bE581bA0de2ef1a366b851242571",
        inCompositionChatMessage: {},
        isMuted: true,
        sessionChatMessages: {},
      },
      "f3e00058-2304-4742-bad7-b3b2a62fb2aa": {
        media: "6c75b9bd-cc20-464d-b9aa-6243b05af064",

        name: "Clemens O'Keefe",
        description:
          "🚀  Fourth Generation Agitator 📈 Working on the intersection of Plant Medicines and Psychedelic Research 🤩 Played chess with Harry Styles at the baggage claim at LAX once 🗣 Reddit/Crypto/Energy Healing 💪 Building major partnerships that drive resentment",
        detectedDevice: {},
        deviceAddress: "0x296f636B0878bE581bA0de2ef1a366b851242571",
        isMuted: true,
        inCompositionChatMessage: {},
        sessionChatMessages: {},
      },
    },
  });

  const s2 = new SyncObject({
    inCompositionChatMessage: {
      id: null,
      createDate: null,
      body: null,
      isTyping: false,
    },
  });

  s2.on(EVT_UPDATED, updatedState => {
    s1.setState({
      peers: {
        "e9affe4b-5fac-44f1-aa0e-520d1015d8ad": {
          inCompositionChatMessage: updatedState,
        },
      },
    });
  });

  s2.setState({
    id: "334e8935-a554-4f5f-9b82-66f85a3d003a",
    createDate: "2022-01-13T03:31:54.447Z",
    body: "111",
    isTyping: false,
  });

  t.deepEquals(s1.getState(), {
    peers: {
      "e9affe4b-5fac-44f1-aa0e-520d1015d8ad": {
        name: "Clemens O'Keefe",
        description:
          "🚀  Fourth Generation Agitator 📈 Working on the intersection of Plant Medicines and Psychedelic Research 🤩 Played chess with Harry Styles at the baggage claim at LAX once 🗣 Reddit/Crypto/Energy Healing 💪 Building major partnerships that drive resentment",
        detectedDevice: {},
        deviceAddress: "0x296f636B0878bE581bA0de2ef1a366b851242571",
        isMuted: true,
        media: "75496223-07cd-4330-9d38-a8d77439808b",
        inCompositionChatMessage: {
          id: "334e8935-a554-4f5f-9b82-66f85a3d003a",
          createDate: "2022-01-13T03:31:54.447Z",
          body: "111",
          isTyping: false,
        },
        sessionChatMessages: {},
      },
      "f3e00058-2304-4742-bad7-b3b2a62fb2aa": {
        name: "Clemens O'Keefe",
        description:
          "🚀  Fourth Generation Agitator 📈 Working on the intersection of Plant Medicines and Psychedelic Research 🤩 Played chess with Harry Styles at the baggage claim at LAX once 🗣 Reddit/Crypto/Energy Healing 💪 Building major partnerships that drive resentment",
        detectedDevice: {},
        deviceAddress: "0x296f636B0878bE581bA0de2ef1a366b851242571",
        isMuted: true,
        media: "6c75b9bd-cc20-464d-b9aa-6243b05af064",
        inCompositionChatMessage: {},
        sessionChatMessages: {},
      },
    },
  });

  s2.setState({
    id: null,
    createDate: null,
    body: null,
    isTyping: true,
  });

  t.deepEquals(s1.getState(), {
    peers: {
      "e9affe4b-5fac-44f1-aa0e-520d1015d8ad": {
        name: "Clemens O'Keefe",
        description:
          "🚀  Fourth Generation Agitator 📈 Working on the intersection of Plant Medicines and Psychedelic Research 🤩 Played chess with Harry Styles at the baggage claim at LAX once 🗣 Reddit/Crypto/Energy Healing 💪 Building major partnerships that drive resentment",
        detectedDevice: {},
        deviceAddress: "0x296f636B0878bE581bA0de2ef1a366b851242571",
        isMuted: true,
        media: "75496223-07cd-4330-9d38-a8d77439808b",
        inCompositionChatMessage: {
          id: null,
          createDate: null,
          body: null,
          isTyping: true,
        },
        sessionChatMessages: {},
      },
      "f3e00058-2304-4742-bad7-b3b2a62fb2aa": {
        name: "Clemens O'Keefe",
        description:
          "🚀  Fourth Generation Agitator 📈 Working on the intersection of Plant Medicines and Psychedelic Research 🤩 Played chess with Harry Styles at the baggage claim at LAX once 🗣 Reddit/Crypto/Energy Healing 💪 Building major partnerships that drive resentment",
        detectedDevice: {},
        deviceAddress: "0x296f636B0878bE581bA0de2ef1a366b851242571",
        isMuted: true,
        media: "6c75b9bd-cc20-464d-b9aa-6243b05af064",
        inCompositionChatMessage: {},
        sessionChatMessages: {},
      },
    },
  });

  s2.setState({
    isTyping: false,
  });

  t.deepEquals(s1.getState(), {
    peers: {
      "e9affe4b-5fac-44f1-aa0e-520d1015d8ad": {
        name: "Clemens O'Keefe",
        description:
          "🚀  Fourth Generation Agitator 📈 Working on the intersection of Plant Medicines and Psychedelic Research 🤩 Played chess with Harry Styles at the baggage claim at LAX once 🗣 Reddit/Crypto/Energy Healing 💪 Building major partnerships that drive resentment",
        detectedDevice: {},
        deviceAddress: "0x296f636B0878bE581bA0de2ef1a366b851242571",
        isMuted: true,
        media: "75496223-07cd-4330-9d38-a8d77439808b",
        inCompositionChatMessage: {
          id: null,
          createDate: null,
          body: null,
          isTyping: false,
        },
        sessionChatMessages: {},
      },
      "f3e00058-2304-4742-bad7-b3b2a62fb2aa": {
        name: "Clemens O'Keefe",
        description:
          "🚀  Fourth Generation Agitator 📈 Working on the intersection of Plant Medicines and Psychedelic Research 🤩 Played chess with Harry Styles at the baggage claim at LAX once 🗣 Reddit/Crypto/Energy Healing 💪 Building major partnerships that drive resentment",
        detectedDevice: {},
        deviceAddress: "0x296f636B0878bE581bA0de2ef1a366b851242571",
        isMuted: true,
        media: "6c75b9bd-cc20-464d-b9aa-6243b05af064",
        inCompositionChatMessage: {},
        sessionChatMessages: {},
      },
    },
  });

  t.end();
});
