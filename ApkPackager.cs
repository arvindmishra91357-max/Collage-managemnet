using System;
using System.IO;
using System.IO.Compression;
using System.Collections.Generic;
using System.Text;

public class ApkPackager {
    public static void CreateApk(string inputDir, string outputApk) {
        if (File.Exists(outputApk)) {
            File.Delete(outputApk);
        }

        inputDir = Path.GetFullPath(inputDir);
        var files = Directory.GetFiles(inputDir, "*", SearchOption.AllDirectories);

        using (var fsOut = new FileStream(outputApk, FileMode.Create, FileAccess.ReadWrite))
        using (var bw = new BinaryWriter(fsOut)) {
            var centralDirectory = new List<byte[]>();

            foreach (var file in files) {
                string relPath = file.Substring(inputDir.Length + 1).Replace("\\", "/");
                byte[] uncompressedData = File.ReadAllBytes(file);
                uint crc = ComputeCrc32(uncompressedData);
                uint uncompressedSize = (uint)uncompressedData.Length;

                // Android rules: resources.arsc, png, jpg MUST be Stored (Method 0)
                bool isStored = relPath.Equals("resources.arsc", StringComparison.OrdinalIgnoreCase) ||
                               relPath.EndsWith(".png", StringComparison.OrdinalIgnoreCase) ||
                               relPath.EndsWith(".jpg", StringComparison.OrdinalIgnoreCase);

                ushort compressionMethod = isStored ? (ushort)0 : (ushort)8;
                byte[] compressedData = uncompressedData;

                if (!isStored) {
                    using (var msComp = new MemoryStream()) {
                        using (var defStream = new DeflateStream(msComp, CompressionMode.Compress, true)) {
                            defStream.Write(uncompressedData, 0, uncompressedData.Length);
                        }
                        compressedData = msComp.ToArray();
                    }
                }

                uint compressedSize = (uint)compressedData.Length;
                uint localHeaderOffset = (uint)fsOut.Position;
                byte[] nameBytes = Encoding.UTF8.GetBytes(relPath);

                // Write Local File Header
                bw.Write((uint)0x04034b50); // Signature
                bw.Write((ushort)20);       // Version needed (2.0)
                bw.Write((ushort)0);        // General purpose bit flag
                bw.Write(compressionMethod);// Compression method (0 or 8)
                bw.Write((ushort)0);        // Last mod time
                bw.Write((ushort)0x5291);   // Last mod date
                bw.Write(crc);              // CRC-32
                bw.Write(compressedSize);   // Compressed size
                bw.Write(uncompressedSize); // Uncompressed size
                bw.Write((ushort)nameBytes.Length); // File name length
                bw.Write((ushort)0);        // Extra field length
                bw.Write(nameBytes);        // File name
                bw.Write(compressedData);   // Data

                // Prepare Central Directory Header
                using (var msCd = new MemoryStream())
                using (var cdBw = new BinaryWriter(msCd)) {
                    cdBw.Write((uint)0x02014b50); // Central directory signature
                    cdBw.Write((ushort)20);       // Version made by
                    cdBw.Write((ushort)20);       // Version needed
                    cdBw.Write((ushort)0);        // Flags
                    cdBw.Write(compressionMethod);
                    cdBw.Write((ushort)0);        // Time
                    cdBw.Write((ushort)0x5291);   // Date
                    cdBw.Write(crc);
                    cdBw.Write(compressedSize);
                    cdBw.Write(uncompressedSize);
                    cdBw.Write((ushort)nameBytes.Length);
                    cdBw.Write((ushort)0);        // Extra length
                    cdBw.Write((ushort)0);        // Comment length
                    cdBw.Write((ushort)0);        // Disk start
                    cdBw.Write((ushort)0);        // Internal attrs
                    cdBw.Write((uint)0);          // External attrs
                    cdBw.Write(localHeaderOffset);// Offset
                    cdBw.Write(nameBytes);
                    centralDirectory.Add(msCd.ToArray());
                }
            }

            uint cdOffset = (uint)fsOut.Position;
            uint cdSize = 0;
            foreach (var cdEntry in centralDirectory) {
                bw.Write(cdEntry);
                cdSize += (uint)cdEntry.Length;
            }

            // End of Central Directory Record
            bw.Write((uint)0x06054b50); // EOCD signature
            bw.Write((ushort)0);        // Disk number
            bw.Write((ushort)0);        // Disk with CD
            bw.Write((ushort)centralDirectory.Count); // Entries on disk
            bw.Write((ushort)centralDirectory.Count); // Total entries
            bw.Write(cdSize);           // Size of CD
            bw.Write(cdOffset);         // Offset of CD
            bw.Write((ushort)0);        // Comment length
        }
    }

    private static uint ComputeCrc32(byte[] data) {
        uint[] table = new uint[256];
        for (uint i = 0; i < 256; i++) {
            uint entry = i;
            for (int j = 0; j < 8; j++) {
                if ((entry & 1) == 1) entry = (entry >> 1) ^ 0xedb88320;
                else entry >>= 1;
            }
            table[i] = entry;
        }

        uint crc = 0xffffffff;
        foreach (byte b in data) {
            crc = (crc >> 8) ^ table[(crc & 0xff) ^ b];
        }
        return ~crc;
    }
}
