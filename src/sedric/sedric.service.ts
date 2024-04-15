import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISedricTeam, IUploadUrlResponse } from './sedric.interface';
import fs from 'fs';
import mime from 'mime-types';
import axios, { AxiosHeaders, AxiosResponse } from 'axios';
import moment from 'moment';

@Injectable()
export class SedricService {
  constructor(private configService: ConfigService) {}

  private readonly teams: ISedricTeam[] = [
    {
      name: 'evest-org-team-1-ar',
      members: [
        { name: 'Rabea Nijim', id: new Set([202, 2041]) },
        { name: 'Wael Elias', id: new Set([309, 2038]) },
        { name: 'Nizar Asaad', id: new Set([312, 2035]) },
        { name: 'Ibrahim Ahmad', id: new Set([313, 2037]) },
        { name: 'Muhammad Milhem', id: new Set([314, 2064]) },
        { name: 'Yasser Morad', id: new Set([315, 2034]) },
        { name: 'Michael Abawi', id: new Set([316, 2033]) },
        { name: 'Christian Abi Samra', id: new Set([317, 2023]) },
        { name: 'John Louis', id: new Set([318, 2066]) },
        { name: 'Basel Riziq', id: new Set([319, 2027]) },
        { name: 'Sandy Habib', id: new Set([214, 2036]) },
        { name: 'Iyad Kriem', id: new Set([240, 2067]) },
      ],
      key: this.configService.get('SEDRIC_API_KEY'),
    },
    {
      name: 'evest-org-team-2-ar',
      members: [
        { name: 'Amal Dyab', id: new Set([2140, 2114, 2039]) },
        { name: 'Diaa Dasoky', id: new Set([2121, 2022, 2001]) },
        { name: 'Nimer Shahen', id: new Set([2051, 2000, 2020]) },
        { name: 'Qasem Akry', id: new Set([3027, 2154, 2021]) },
        { name: 'Mtanes Nsere', id: new Set([2153, 2060, 2022]) },
        { name: 'Mohannad Salem', id: new Set([2151, 2062, 2049]) },
        { name: 'Bolous', id: new Set([2046, 3053, 2024]) },
        { name: 'Ahmad Nasser', id: new Set([2007, 3055, 2025]) },
        { name: 'Rafiq Helu', id: new Set([2159, 2159]) },
        { name: 'Ahmad Faour', id: new Set([2175, 2175]) },
        { name: 'Jad Rabeaa', id: new Set([2039, 2039]) },
        { name: 'Loai Swaaed', id: new Set([2025, 2025]) },
        { name: 'Lama Mansour', id: new Set([2141, 2141]) },
        { name: 'Mohamad Abu Liel', id: new Set([2147, 2147]) },
        { name: 'Abed Habashi', id: new Set([2021, 2021]) },
        { name: 'Ahmad Agbaria', id: new Set([2123, 2123]) },
        { name: 'Mohannad Saleh', id: new Set([2150, 2150, 2000]) },
        { name: 'Milad Sliman', id: new Set([2146, 2146, 2003]) },
        { name: 'Tofeq Atiye', id: new Set([2178, 2178, 2004]) },
        { name: 'Tawfeek Armaly', id: new Set([3041, 3041, 2043]) },
        { name: 'Mohamad Kenaan', id: new Set([2124, 2124, 2044]) },
        { name: 'Sari Matar', id: new Set([2170, 2170, 2045]) },
        { name: 'Tojan Salti', id: new Set([2179, 2179, 2032]) },
        { name: 'Mohammad Odeh', id: new Set([3039, 3039, 4022]) },
        { name: 'Remah Soliman', id: new Set([2189, 2189, 2046]) },
        { name: 'Layale Alwan', id: new Set([2048, 2048, 2047]) },
        { name: 'Tarek Zatme', id: new Set([2052, 2052, 2068]) },
        { name: 'Azez Knane', id: new Set([2129, 2129, 2069]) },
        { name: 'Donia Abdullah', id: new Set([3001, 3001, 2050]) },
        { name: 'Mahmod Abu Ahmad', id: new Set([2111, 2111, 2071]) },
      ],
      key: this.configService.get('SEDRIC_API_KEY'),
    },
    {
      name: 'evest-org-team-3-ar',
      members: [
        { name: 'Ahlam Boukernafa', id: new Set([2038, 2051]) },
        { name: 'Tamer Amin', id: new Set([2107, 2070]) },
        { name: 'Siham Mosa', id: new Set([2172, 2052]) },
        { name: 'Heyam Hajaj', id: new Set([2155, 2053]) },
        { name: 'Mohammad Bsoul', id: new Set([2162, 2054]) },
        { name: 'Rula Jaaror', id: new Set([3013, 2055]) },
        { name: 'Doaa Alrozi', id: new Set([2013, 2056]) },
        { name: 'Dania Yousef', id: new Set([2012, 2057]) },
        { name: 'Elaf Jbara', id: new Set([2108, 2058]) },
        { name: 'Fayrouz Djihene', id: new Set([2102, 2059]) },
        { name: 'Amina Darlekt', id: new Set([2144, 2060]) },
        { name: 'Omar Ziyad', id: new Set([2004, 2061]) },
        { name: 'Muhammed Ahmedo', id: new Set([2188, 2062]) },
        { name: 'Baker Shamot', id: new Set([2135, 2063]) },
      ],
      key: this.configService.get('SEDRIC_API_KEY'),
    },
    {
      name: 'evest-org-sales-unit-1-ar',
      members: [
        { name: 'Owis Alzubairi', id: new Set([3035, 418, 4012]) },
        { name: 'Wassim Shaarani', id: new Set([292, 2065]) },
        { name: 'Reem Bshara', id: new Set([234, 2072]) },
        { name: 'Motaz Saleh', id: new Set([294, 2073]) },
        { name: 'Yomna Esawi', id: new Set([295, 2074]) },
        { name: 'Tarek Mahfouz', id: new Set([201, 2075]) },
        { name: 'Saddam Ghurab', id: new Set([232, 2018]) },
        { name: 'Sara Maksoud', id: new Set([233, 2019]) },
        { name: 'Gabi Qdado', id: new Set([2138, 419, 4011]) },
        { name: 'Adnan Alzuabi', id: new Set([228, 2015]) },
        { name: 'Abdullah Madhi', id: new Set([235, 2076]) },
        { name: 'Kenan Bakro', id: new Set([236, 2016]) },
        { name: 'Tarek Bou Said', id: new Set([249, 2077]) },
        { name: 'Mohamad Salah', id: new Set([237, 2078]) },
        { name: 'Aws Younes', id: new Set([243, 2079]) },
        { name: 'Rima Esawi', id: new Set([297, 2080]) },
        { name: 'Khaled Alhammadi', id: new Set([3040, 420, 4013]) },
        { name: 'Paula Zakour', id: new Set([285, 2081]) },
        { name: 'Khaled Almhasda', id: new Set([289, 2082]) },
        { name: 'Waleed Ahmed', id: new Set([264, 2083]) },
        { name: 'Fadi Mabjish', id: new Set([262, 2084]) },
        { name: 'Fathi Jat', id: new Set([290, 2085]) },
        { name: 'Tala Muri', id: new Set([286, 2017]) },
        { name: 'Saleh Hejaze', id: new Set([2098, 411, 4004]) },
        { name: 'Emil Rashed', id: new Set([277, 2086]) },
        { name: 'Mohammad Bsoul', id: new Set([229, 2087]) },
        { name: 'Maysara Shehade', id: new Set([]) }, // No IDs provided
        { name: 'Mohamad Masarwe', id: new Set([304, 2089]) },
        { name: 'Ilarion Saiegh', id: new Set([305, 2090]) },
      ],
      key: this.configService.get('SEDRIC_API_SALES_KEY'),
    },
    {
      name: 'evest-org-sales-unit-2-ar',
      members: [
        { name: 'Weaam Zidan', id: new Set([2114, 231]) },
        { name: 'Rama Awad', id: new Set([3074, 217]) },
        { name: 'Taqwa Mohammad', id: new Set([2081, 303]) },
        { name: 'Abeer Kudari', id: new Set([2154, 281]) },
        { name: 'Mohamad Abdul Rahman', id: new Set([2062, 282]) },
        { name: 'Fathi Samatar', id: new Set([2117, 280]) },
        { name: 'Basma Attia', id: new Set([3055, 279]) },
        { name: 'Isra Mahmoud', id: new Set([215, 2099]) },
        { name: 'Faten Hamza', id: new Set([246, 2014]) },
        { name: 'Asia Adem', id: new Set([247, 2013]) },
        { name: 'Danya Rifai', id: new Set([2097, 415]) },
        { name: 'Betul Isavi', id: new Set([3025, 258]) },
        { name: 'Zakaria Messaly', id: new Set([2157, 259]) },
        { name: 'Soufiane Akdim', id: new Set([2045, 263]) },
        { name: 'Mohamad Alshihan', id: new Set([2083, 297]) },
        { name: 'Amira Ibrahim', id: new Set([3069, 212]) },
        { name: 'Rami Sultan', id: new Set([3072, 206]) },
        { name: 'Qamar Aldarraji', id: new Set([3087, 210]) },
        { name: 'Haya Abusidu', id: new Set([2183, 241]) },
        { name: 'Amal Zain al Abdeen', id: new Set([275, 2007]) },
        { name: 'Aisha Alhakami', id: new Set([238, 2008]) },
        { name: 'Mizgin Khoja', id: new Set([2055, 413, 4006]) },
        { name: 'Sahed Ah', id: new Set([2181, 208]) },
        { name: 'Baraa Abboud', id: new Set([2171, 271]) },
        { name: 'Ines Horo', id: new Set([2103, 239]) },
        { name: 'Ranya Alabdo', id: new Set([3076, 301]) },
        { name: 'Zain Alaabdi', id: new Set([3049, 254]) },
        { name: 'Esraa Ramadan', id: new Set([2028, 255]) },
        { name: 'Saif Ofainat', id: new Set([2018, 256]) },
        { name: 'Fadil Alzuwaini', id: new Set([3088, 223]) },
        { name: 'Sinaa Elmuhammed', id: new Set([2182, 211]) },
        { name: 'Muhammed Rahme', id: new Set([222, 2006]) },
        { name: 'Omar Ghazal', id: new Set([253, 2005]) },
        { name: 'Ammar Masarwa', id: new Set([3016, 417]) },
        { name: 'Muna Huseyin', id: new Set([3054, 283]) },
        { name: 'Batol Kozanli', id: new Set([2125, 265]) },
        { name: 'Waad Alsheikh', id: new Set([3081, 207]) },
        { name: 'Ragad Casim', id: new Set([3073, 307]) },
        { name: 'Adil Resid', id: new Set([3071, 203]) },
        { name: 'Maram Alshoushan', id: new Set([3090, 309]) },
        { name: 'Aya Hannachi', id: new Set([2009, 287]) },
        { name: 'Maryam Aboodi', id: new Set([3095, 293]) },
        { name: 'Maram Seyhosman', id: new Set([274, 2098]) },
        { name: 'Hayder Hamad', id: new Set([273, 2097]) },
        { name: 'Abdallah Abu Leil', id: new Set([2020]) },
        { name: 'Ayat Al Akraa', id: new Set([2008, 278]) },
        { name: 'Nuha Masalati', id: new Set([3036, 218]) },
        { name: 'Sabra Aroumi', id: new Set([2056, 261]) },
        { name: 'Asmaa Omran', id: new Set([2042, 272]) },
        { name: 'Hazem Abdallatef', id: new Set([2137, 248]) },
        { name: 'Aisha Eid', id: new Set([2168, 268]) },
        { name: 'Amal Alomar', id: new Set([3009, 267]) },
        { name: 'Waseem Abdelsalam', id: new Set([2194, 205]) },
        { name: 'Moutasem Hendawi', id: new Set([221, 2093]) },
        { name: 'Joudy Jabban', id: new Set([250, 2094]) },
        { name: 'Rawan Razzouk', id: new Set([2001, 450]) },
        { name: 'Fatima Jlilati', id: new Set([2050, 269]) },
        { name: 'Huriah Al Shiaani', id: new Set([3032, 225]) },
        { name: 'Yahia Barazi', id: new Set([3098, 306]) },
        { name: 'Zeinab Mah', id: new Set([3086, 251]) },
        { name: 'Samaa Salih', id: new Set([3085, 299]) },
        { name: 'Mahir Eltakli', id: new Set([3070, 296]) },
        { name: 'Zahraa Sahib', id: new Set([3083, 300]) },
        { name: 'Hassna Farhaou', id: new Set([3096, 288]) },
        { name: 'Razan Almughrbi', id: new Set([298, 2096]) },
        { name: 'Hakima Ibrahim', id: new Set([266, 2098]) },
        { name: 'Ameer Abu Nasra', id: new Set([2067, 416, 4008]) },
        { name: 'Mayada Elsayed', id: new Set([3007, 213]) },
        { name: 'Mecid Zarur', id: new Set([2065, 270]) },
        { name: 'Hadil Hajjar', id: new Set([2080, 311]) },
        { name: 'Tayma Rshid', id: new Set([3028, 227]) },
        { name: 'Waed Alnajjar', id: new Set([3092, 200]) },
        { name: 'Hiba Hemaid', id: new Set([3093, 242]) },
        { name: 'Ragad Kazmoz', id: new Set([2106, 220, 2012]) },
        { name: 'Reem Fadoun', id: new Set([2036, 224, 2011]) },
        { name: 'Haidy Wael', id: new Set([2017, 226, 2009]) },
        { name: 'Maryam Mohamed', id: new Set([3014, 230, 2010]) },
        { name: 'Hasan Abdulkhalek', id: new Set([2156, 416]) },
        { name: 'Marwa Akhdaich', id: new Set([3000, 276]) },
        { name: 'Reham Hamdeh', id: new Set([2060, 284]) },
        { name: 'Sirree Ofainat', id: new Set([3018, 308]) },
        { name: 'Ayoob Sabahaldin', id: new Set([3052, 245]) },
        { name: 'Hadel Daaboul', id: new Set([3077, 209]) },
        { name: 'Rahaf Saban', id: new Set([3080, 204]) },
        { name: 'Rana Alrantisi', id: new Set([3078, 302]) },
        { name: 'Mariam Zaky', id: new Set([2049, 260]) },
        { name: 'Sedra Mahmoud', id: new Set([244, 2091]) },
        { name: 'Marwh Alrifai', id: new Set([257, 2092]) },
      ],
      key: this.configService.get('SEDRIC_API_SALES_KEY'),
    },
  ];

  findMemberById(
    id: string,
    name?: string,
  ): {
    apiKey: string;
    memberName: string;
    team: string;
  } {
    const numId = Number(id);

    for (const team of this.teams) {
      for (const member of team.members) {
        if (member.id.has(numId) || (name && member.name === name)) {
          return {
            team: team.name,
            memberName: member.name,
            apiKey: team.key,
          };
        }
      }
    }

    return {
      team: 'evest-org-team-2-ar',
      memberName: name || id,
      apiKey: this.configService.get('SEDRIC_API_KEY'),
    };
  }

  parseUserId(input: string): {
    metadata: { extension: string };
  } {
    const regex = /^(?<userId>[^<]+)<(?<extension>[^>]+)>$/;
    const match = input.match(regex);

    if (!match || !match.groups) {
      return {
        metadata: { extension: input },
      };
    }

    const { extension } = match.groups;
    return {
      metadata: { extension: extension.trim() },
    };
  }

  formatDateString(dateStr: string): string {
    const formats = ['DD/MM/YYYY hh:mm:ss A', moment.ISO_8601];
    const parsedDate = moment(dateStr, formats);

    if (!parsedDate.isValid())
      throw new Error(`Unable to parse date: ${dateStr}`);

    return parsedDate.utc().format('YYYY-MM-DDTHH:mm:ss[Z]');
  }

  async uploadRecording(
    filePath: string,
    upload: IUploadUrlResponse,
  ): Promise<any> {
    const stream = fs.createReadStream(filePath);
    const mimeType = mime.lookup(filePath) || 'application/octet-stream';

    try {
      const response = await axios.put(upload.url, stream, {
        headers: {
          'Content-Type': mimeType,
          ...(upload.headers as unknown as AxiosHeaders),
        },
      });

      if (response.status !== 200)
        return new Error('Failed to upload recording');

      return response.data;
    } catch (error) {
      throw error;
    }
  }
  async generateUploadUrl(dataObject: {
    user_id: string;
    prospect_id: string;
    unit_id: string;
    external_interaction_id?: string;
    recording_type: string;
    timestamp: string;
    topic: string;
    metadata?: any;
    api_key: string;
  }): Promise<IUploadUrlResponse> {
    const apiUrl = this.configService.get('SEDRIC_API_URL');
    const url = `${apiUrl}/api_recording_uri`;
    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: url,
      data: JSON.stringify({
        ...dataObject,
        timestamp: this.formatDateString(dataObject.timestamp),
      }),
    };

    try {
      const response: AxiosResponse<IUploadUrlResponse> =
        await axios.request(config);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
}
