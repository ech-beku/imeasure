using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DataManager
{
    class Program
    {
        static void Main(string[] args)
        {
            var dataFiles = Directory.GetFiles(@"C:\Users\Beda\Dropbox\FFHS\BACH\results\Umgebung_1");

            JArray extData = null;

            for (var i = 0; i < dataFiles.Length; i++)
            {

                if (!dataFiles[i].Contains("avg.json"))
                {
                    var data = JArray.Parse(File.ReadAllText(dataFiles[i]));
                    correctDelays(data);

                    if (extData == null) extData = data;
                    else
                    {
                        foreach (var item in extData)
                        {
                            var objId = item["objectid"].Value<int>();
                            var delay = item["delay"].Value<int>();

                            var corresponding = data.FirstOrDefault(t => t["objectid"].Value<int>() == objId && t["delay"].Value<int>() == delay);

                            if (corresponding != null)
                            {
                                foreach (var sig in corresponding["signals"].Value<JArray>())
                                {
                                    item["signals"].Value<JArray>().Add(sig);
                                }
                            }
                        }
                    }
                }

            }

            averageRssis(extData);

            File.WriteAllText(@"C:\Users\Beda\Dropbox\FFHS\BACH\results\Umgebung_1\avg.json", extData.ToString());

        }

        private static void correctDelays(JArray data)
        {
            foreach (var item in data)
            {
                var del = item["delay"].Value<int>();
                item["delay"] = Math.Round(del / 1000.0) * 1000;
            }
        }

        private static void averageRssis(JArray data)
        {
            foreach (var item in data)
            {
                var sigs = item["signals"].Value<JArray>();

                var minors = sigs.GroupBy(t => t["minor"].Value<int>());
                var avgPerMinor = minors.Select(t => new { key = t.Key, avg = t.Average(s => s["rssi"].Value<double>()) }).ToList();

                sigs.Clear();

                foreach (var avg in avgPerMinor)
                {
                    var a = new JObject();
                    a["minor"] = avg.key;
                    a["rssi"] = avg.avg;
                    sigs.Add(a);
                }

            }
        }
    }
}
