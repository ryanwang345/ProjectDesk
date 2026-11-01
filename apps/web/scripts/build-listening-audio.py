#!/usr/bin/env python3
"""
Builds multi-speaker IELTS Listening practice audio tracks (part1.m4a .. part4.m4a)
with official exam announcer introductions, studio exam chimes, distinct UK/US/AU
speaker voices, and prints exact segment timestamps for src/lib/listening.ts.
"""

import json
import math
import os
import struct
import subprocess
import tempfile
import wave

SAMPLE_RATE = 22050
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "audio", "listening")


def make_silence(seconds: float) -> bytes:
    n = int(SAMPLE_RATE * seconds)
    return b"\x00\x00" * n


def make_chime() -> bytes:
    frames = bytearray()
    for freq, dur in [(523.25, 0.20), (659.25, 0.36)]:
        n = int(SAMPLE_RATE * dur)
        for i in range(n):
            t = i / SAMPLE_RATE
            env = math.sin(math.pi * min(1.0, t / 0.02)) * math.exp(-4.5 * t)
            sample = 0.22 * env * (
                math.sin(2 * math.pi * freq * t)
                + 0.3 * math.sin(4 * math.pi * freq * t)
            )
            val = int(32767 * max(-1.0, min(1.0, sample)))
            frames += struct.pack("<h", val)
    return bytes(frames)


def synth_pcm(text: str, voice: str, rate: int) -> bytes:
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav_path = tmp.name
    try:
        subprocess.run(
            [
                "/usr/bin/say",
                "-v",
                voice,
                "-r",
                str(rate),
                "-o",
                wav_path,
                f"--data-format=LEI16@{SAMPLE_RATE}",
                text,
            ],
            check=True,
        )
        with wave.open(wav_path, "rb") as wf:
            return wf.readframes(wf.getnframes())
    finally:
        if os.path.exists(wav_path):
            os.remove(wav_path)


PARTS = [
    {
        "partNumber": 1,
        "filename": "part1.m4a",
        "segments": [
            {
                "id": "p1-intro",
                "speaker": "IELTS Examiner",
                "voice": "Moira",
                "rate": 160,
                "chimeAfter": True,
                "pauseAfter": 1.0,
                "text": "IELTS Listening. Part 1. You will hear a postgraduate student telephoning a university accommodation officer to confirm his room booking and campus sports pass. First, you have a moment to look at questions 1 to 6. Now listen carefully and answer questions 1 to 6.",
            },
            {
                "id": "p1-s1",
                "speaker": "Advisor (Claire)",
                "voice": "Flo (English (UK))",
                "rate": 170,
                "pauseAfter": 0.65,
                "text": "Good morning, Harbourview Student Services, Claire speaking. How can I help you today?",
            },
            {
                "id": "p1-s2",
                "speaker": "Student (Daniel)",
                "voice": "Reed (English (US))",
                "rate": 174,
                "pauseAfter": 0.75,
                "text": "Hi Claire. My name is Daniel Lin. I am starting my postgraduate course next Monday and I need to confirm my booking at the North Wing residence. I initially thought about the studio flat, but my budget is tight, so I opted for the shared en-suite room facing the courtyard.",
            },
            {
                "id": "p1-s3",
                "speaker": "Advisor (Claire)",
                "voice": "Flo (English (UK))",
                "rate": 168,
                "pauseAfter": 0.75,
                "text": "Let me pull up your file, Daniel. Yes, I see it here. Room 304, facing the quiet courtyard rather than the main street. Now, for the postal address on your arrival pack, the building postcode used to be H B 4, 7 R T, but last month the Royal Mail updated our block to H B 4, 9 L P.",
            },
            {
                "id": "p1-s4",
                "speaker": "Student (Daniel)",
                "voice": "Reed (English (US))",
                "rate": 172,
                "pauseAfter": 0.70,
                "text": "Got it, H B 4, 9 L P. And what about the refundable key and kitchen deposit? The website brochure mentioned 150 pounds, is that still accurate?",
            },
            {
                "id": "p1-s5",
                "speaker": "Advisor (Claire)",
                "voice": "Flo (English (UK))",
                "rate": 168,
                "pauseAfter": 0.75,
                "text": "150 pounds was for last academic year. Starting this September, the refundable deposit is 185 pounds, which covers your smart keycard and shared induction cookware. Also, please let the kitchen coordinator know if you have any allergies—I have noted down your allergy to shellfish.",
            },
            {
                "id": "p1-s6",
                "speaker": "Student (Daniel)",
                "voice": "Reed (English (US))",
                "rate": 174,
                "pauseAfter": 0.60,
                "text": "Thank you! One last thing—I would love to join the campus swimming pool this semester.",
            },
            {
                "id": "p1-s7",
                "speaker": "Advisor (Claire)",
                "voice": "Flo (English (UK))",
                "rate": 168,
                "pauseAfter": 1.0,
                "text": "Sure! Full-time residents get free off-peak entry, and if you attend the induction tour on Thursday morning, we include a complimentary locker towel pass for the semester.",
            },
        ],
    },
    {
        "partNumber": 2,
        "filename": "part2.m4a",
        "segments": [
            {
                "id": "p2-intro",
                "speaker": "IELTS Examiner",
                "voice": "Moira",
                "rate": 160,
                "chimeAfter": True,
                "pauseAfter": 1.0,
                "text": "Part 2. You will hear a heritage park ranger welcoming visitors to Greenfield Heritage Mill and Botanical Gardens. First, look at the visitor map and questions 7 to 12. Now listen carefully and answer questions 7 to 12.",
            },
            {
                "id": "p2-s1",
                "speaker": "Ranger (Owen)",
                "voice": "Daniel",
                "rate": 166,
                "pauseAfter": 0.75,
                "text": "Welcome everyone to Greenfield Heritage Mill. Right now, we are standing together at the Main South Gate at the bottom of your map. Before you set off, let me point out where the key facilities are located.",
            },
            {
                "id": "p2-s2",
                "speaker": "Ranger (Owen)",
                "voice": "Daniel",
                "rate": 165,
                "pauseAfter": 0.80,
                "text": "If you walk straight ahead from the Main South Gate along the Central Cobble Path, before you reach the Mill Pond, look to your immediate left—that rectangular building on the west side of the lower path is the Artisan Bakery, shown as building A.",
            },
            {
                "id": "p2-s3",
                "speaker": "Ranger (Owen)",
                "voice": "Daniel",
                "rate": 165,
                "pauseAfter": 0.80,
                "text": "Directly opposite the Artisan Bakery, on the right-hand east side of the entrance path, people often expect the ticket kiosk, but it has been converted into our Seed Library, marked as building B.",
            },
            {
                "id": "p2-s4",
                "speaker": "Ranger (Owen)",
                "voice": "Daniel",
                "rate": 165,
                "pauseAfter": 0.80,
                "text": "Continuing north past the central Mill Pond, you will cross the Wooden Footbridge over the stream. Immediately across the bridge in the far north-east corner, tucked beside the pine trees, is the Glasshouse Apiary where we keep our honeybees—that is building D.",
            },
            {
                "id": "p2-s5",
                "speaker": "Ranger (Owen)",
                "voice": "Daniel",
                "rate": 165,
                "pauseAfter": 1.0,
                "text": "Finally, for families joining the afternoon pottery workshop: instead of crossing the footbridge, turn west along the north bank of the Mill Pond right next to the Old Waterwheel. Building C, right beside the waterwheel, is the Waterwheel Pottery Studio. Note that the picnic lawn opens at noon, and photography inside the mill requires no flash.",
            },
        ],
    },
    {
        "partNumber": 3,
        "filename": "part3.m4a",
        "segments": [
            {
                "id": "p3-intro",
                "speaker": "IELTS Examiner",
                "voice": "Moira",
                "rate": 160,
                "chimeAfter": True,
                "pauseAfter": 1.0,
                "text": "Part 3. You will hear an environmental engineering lecturer, Dr. Evans, discussing a stormwater microplastic filtration pilot with two postgraduate students, Maya and Liam. First, look at questions 13 to 18. Now listen carefully and answer questions 13 to 18.",
            },
            {
                "id": "p3-s1",
                "speaker": "Dr. Evans",
                "voice": "Daniel",
                "rate": 165,
                "pauseAfter": 0.70,
                "text": "Come in, Maya and Liam. I have reviewed your preliminary data on trapping microplastics from highway stormwater drains. Before we look at the filter materials, what surprised you most about the initial sample collection?",
            },
            {
                "id": "p3-s2",
                "speaker": "Maya",
                "voice": "Samantha",
                "rate": 172,
                "pauseAfter": 0.75,
                "text": "Well, Dr. Evans, Liam and I assumed plastic packaging fragments would dominate. However, once we analysed the sediment under spectroscopy, over 70 percent of the particles turned out to be microscopic tyre wear rubber washed off the asphalt during braking.",
            },
            {
                "id": "p3-s3",
                "speaker": "Liam",
                "voice": "Karen",
                "rate": 170,
                "pauseAfter": 0.75,
                "text": "Exactly. And when we tested our first filter medium—the Biochar Sand Bed—we thought it might be too expensive, but it was actually dirt cheap. The real issue was that after just one autumn storm, decaying leaves sealed the top layer and it blocked up completely.",
            },
            {
                "id": "p3-s4",
                "speaker": "Maya",
                "voice": "Samantha",
                "rate": 172,
                "pauseAfter": 0.75,
                "text": "Then we trialled the Acoustic Mesh Cartridge. It never clogged, and while we worried frost might crack the casing, its filtration rate stayed remarkably steady even when overnight temperatures dropped below freezing.",
            },
            {
                "id": "p3-s5",
                "speaker": "Liam",
                "voice": "Karen",
                "rate": 170,
                "pauseAfter": 0.65,
                "text": "As for the Mycelium Fungal Mat, it captured 96 percent of polyester textile threads—higher than any other medium we tested!",
            },
            {
                "id": "p3-s6",
                "speaker": "Dr. Evans",
                "voice": "Daniel",
                "rate": 165,
                "pauseAfter": 1.0,
                "text": "Impressive work, both of you. For next month’s phase, skip adding more highway sites; instead, extend your monitoring period to 90 days so we can measure long-term filter fatigue.",
            },
        ],
    },
    {
        "partNumber": 4,
        "filename": "part4.m4a",
        "segments": [
            {
                "id": "p4-intro",
                "speaker": "IELTS Examiner",
                "voice": "Moira",
                "rate": 160,
                "chimeAfter": True,
                "pauseAfter": 1.0,
                "text": "Part 4. You will hear part of a university lecture on architectural acoustics in ancient amphitheatres and modern concert halls. First, look at questions 19 to 24. Now listen carefully and answer questions 19 to 24.",
            },
            {
                "id": "p4-s1",
                "speaker": "Prof. Sterling",
                "voice": "Reed (English (UK))",
                "rate": 164,
                "pauseAfter": 0.80,
                "text": "Today we turn to one of the most celebrated mysteries of classical architecture: how an actor speaking at normal volume on the stage of the fourth-century BC theatre at Epidaurus could be heard clearly in the fifty-fifth row. Early historians credited prevailing valley winds, yet acoustic measurements prove wind actually scatters sound waves.",
            },
            {
                "id": "p4-s2",
                "speaker": "Prof. Sterling",
                "voice": "Reed (English (UK))",
                "rate": 164,
                "pauseAfter": 0.80,
                "text": "The real breakthrough came from analysing the stepped rows of seating carved from porous limestone. Because these stone benches have a corrugated surface profile, they act as an acoustic trap that suppresses low-frequency background murmur—such as rustling clothes and wind—while reflecting high-frequency vocal consonants.",
            },
            {
                "id": "p4-s3",
                "speaker": "Prof. Sterling",
                "voice": "Reed (English (UK))",
                "rate": 164,
                "pauseAfter": 0.80,
                "text": "Wait—does removing low frequencies make a voice sound thin? Surprisingly, no. Through a psychoacoustic phenomenon known as virtual pitch, the human brain automatically reconstructs the missing fundamental bass tone, allowing listeners in the upper tiers to perceive rich clarity.",
            },
            {
                "id": "p4-s4",
                "speaker": "Prof. Sterling",
                "voice": "Reed (English (UK))",
                "rate": 164,
                "pauseAfter": 0.80,
                "text": "In twentieth-century concert hall design, architects initially obsessed over total silence and installed heavy velvet curtains, which deadened the music. Modern engineers instead suspend an adjustable overhead canopy above the orchestra to direct early reflections toward the balcony.",
            },
            {
                "id": "p4-s5",
                "speaker": "Prof. Sterling",
                "voice": "Reed (English (UK))",
                "rate": 164,
                "pauseAfter": 1.0,
                "text": "Furthermore, to prevent unpleasant echoes from flat concrete walls, contemporary halls line their side walls with timber panels of varying density, and coats of plaster are deliberately textured to diffuse sound evenly across every seat.",
            },
        ],
    },
]


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    chime_pcm = make_chime()
    manifest = {}

    for part in PARTS:
        master_pcm = bytearray()
        master_pcm += make_silence(0.35)
        cursor = 0.35
        seg_timings = []

        for seg in part["segments"]:
            start_t = round(cursor, 1)
            speech_pcm = synth_pcm(seg["text"], seg["voice"], seg["rate"])
            master_pcm += speech_pcm
            dur = len(speech_pcm) / (2.0 * SAMPLE_RATE)
            cursor += dur

            if seg.get("chimeAfter"):
                master_pcm += make_silence(0.25)
                master_pcm += chime_pcm
                cursor += 0.25 + (len(chime_pcm) / (2.0 * SAMPLE_RATE))

            pause = seg.get("pauseAfter", 0.7)
            master_pcm += make_silence(pause)
            cursor += pause
            end_t = round(cursor, 1)

            seg_timings.append(
                {
                    "id": seg["id"],
                    "startTime": start_t,
                    "endTime": end_t,
                }
            )

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_wav:
            wav_path = tmp_wav.name

        try:
            with wave.open(wav_path, "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(SAMPLE_RATE)
                wf.writeframes(bytes(master_pcm))

            out_m4a = os.path.join(OUT_DIR, part["filename"])
            subprocess.run(
                [
                    "/usr/bin/afconvert",
                    "-f",
                    "m4af",
                    "-d",
                    "aac",
                    "-b",
                    "64000",
                    wav_path,
                    out_m4a,
                ],
                check=True,
            )
        finally:
            if os.path.exists(wav_path):
                os.remove(wav_path)

        manifest[part["partNumber"]] = {
            "audioUrl": f"/audio/listening/{part['filename']}",
            "durationSeconds": math.ceil(cursor),
            "segments": seg_timings,
        }

    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
