interface IStrapiResponse<T> {
  data: T[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    }
  }
}

export interface IEvent {
  id: number;
  attributes: EventAttributes;
}

export interface EventAttributes {
  title: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date;
  content: string;
  start_date: Date;
  end_date: Date;
  slug: string;
  type: string;
  gems: number;
  locale: string;
  image: Image;
  localizations: Localizations;
}

export interface Image {
  data: ImageData;
}

export interface ImageData {
  id: number;
  attributes: StrapiImageAttributes;
}

export interface StrapiImageAttributes {
  name: string;
  alternativeText: string;
  caption: string;
  width: number;
  height: number;
  formats: Formats;
  hash: string;
  ext: string;
  mime: string;
  size: number;
  url: string;
  previewUrl: null;
  provider: string;
  provider_metadata: null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Formats {
  large: Large;
  small: Large;
  medium: Large;
  thumbnail: Large;
}

export interface Large {
  ext: string;
  url: string;
  hash: string;
  mime: string;
  name: string;
  path: null;
  size: number;
  width: number;
  height: number;
}

export interface Localizations {
  data: any[];
}