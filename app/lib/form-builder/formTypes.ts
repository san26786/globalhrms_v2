export interface FormConfig {

    id?: number;

    module: string;

    title: string;

    service: any;

    controls: () => Promise<any[]>;

}