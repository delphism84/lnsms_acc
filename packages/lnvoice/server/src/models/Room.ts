import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 64 },
    maxParticipants: { type: Number, default: 8 },
  },
  { timestamps: true }
);

export type RoomDoc = mongoose.InferSchemaType<typeof roomSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Room = mongoose.model("Room", roomSchema);
