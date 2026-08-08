export interface Channel {
  id: string;
  name: string;
  region: string;
  /** YouTube channel id (UC…), resolved once from the channel page. */
  channelId: string;
}

/**
 * Rolling news channels that run a free 24/7 stream.
 *
 * The embed is keyed on the *channel*, not a video id: `live_stream?channel=UC…`
 * always resolves to whatever that channel is currently broadcasting, so nothing
 * here rots when a stream restarts under a new id — which they do daily.
 */
export const CHANNELS: Channel[] = [
  { id: 'aljazeera', name: 'Al Jazeera', region: 'Doha', channelId: 'UCfiwzLy-8yKzIbsmZTzxDgw' },
  { id: 'dw', name: 'DW News', region: 'Berlin', channelId: 'UCbbS1GE942k3UVqpLklyhIA' },
  { id: 'france24', name: 'France 24', region: 'Paris', channelId: 'UCCCPCZNChQdGa9EkATeye4g' },
  { id: 'sky', name: 'Sky News', region: 'London', channelId: 'UCkFclpi8U9VJjfxLYoms7Aw' },
  { id: 'trt', name: 'TRT World', region: 'Istanbul', channelId: 'UCnyCrv8b7bu0oWFXGyHaPzg' },
  { id: 'abcau', name: 'ABC Australia', region: 'Sydney', channelId: 'UCxcrzzhQDj5zKJbXfIscCtg' },
  {
    id: 'africanews',
    name: 'Africanews',
    region: 'Pointe-Noire',
    channelId: 'UC25EuGAePOPvPrUA5cmu3dQ',
  },
];

export const embedUrl = (channel: Channel): string =>
  `https://www.youtube.com/embed/live_stream?channel=${channel.channelId}&autoplay=1&mute=1`;

/** Where to send someone when a publisher refuses to be framed. */
export const watchUrl = (channel: Channel): string =>
  `https://www.youtube.com/channel/${channel.channelId}/live`;
