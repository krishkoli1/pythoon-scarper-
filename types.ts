import React from 'react';

export interface Extractor {
  id: number;
  name: string;
  tag: string;
  attrs: string;
}

export type OutputFormat = 'csv' | 'json' | 'print';

export type ScrapingMode = 'structured' | 'simple';
