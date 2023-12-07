import { FC, useCallback, useEffect, useLayoutEffect, useState } from "react";
import Client, { Product as ShopifyProduct, ProductVariant } from "shopify-buy";

import { PoweredByLogo } from "./PoweredByLogo";
import { ProductTile } from "./ProductTile";
import { SearchInput } from "./SearchInput";
import { SelectedProducts } from "./SelectedProducts";
import { Product } from "./types/product";

export const ShopifyProductSelector: FC = () => {
  const [currentValue, setCurrentValue] = useState<null | ReadonlyArray<Product>>(null);
  const [searchResults, setSearchResults] = useState<ReadonlyArray<Product>>([]);
  const [isDisabled, setIsDisabled] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [config, setConfig] = useState<null | Config>(null);

  const updateSize = useCallback(() => {
    const newSize = Math.max(document.documentElement.offsetHeight, 100);

    CustomElement.setHeight(Math.ceil(newSize));
  }, []);

  const updateValue = useCallback((newValue: ReadonlyArray<Product>) => {
    // send null instead of [] so that the element fails validation when it should not be empty
    CustomElement.setValue(newValue.length ? JSON.stringify(newValue) : null);
    setCurrentValue(newValue);
  }, []);

  useLayoutEffect(() => {
    updateSize();
  }, [updateSize, currentValue, searchResults]);

  useEffect(() => {
    CustomElement.init((el) => {
      if (typeof el.config?.apiDomain !== "string" || typeof el.config.storeFrontAccessToken !== "string") {
        throw new Error(
          "Missing Shopify Endpoint URL or storeFront access token. Please provide the URL and the access token within the custom element JSON config.",
        );
      }
      setConfig({
        apiDomain: el.config.apiDomain,
        storeFrontAccessToken: el.config.storeFrontAccessToken,
        isMultiSelect: !!el.config.isMultiSelect,
      });
      const value = JSON.parse(el.value || "[]");
      setCurrentValue(Array.isArray(value) ? value : [value]); // treat old values (not saved as an array) as a single product
      setIsDisabled(el.disabled);
      updateSize();
    });
  }, [updateSize]);

  useEffect(() => {
    CustomElement.onDisabledChanged(setIsDisabled);
  }, []);

  useEffect(() => {
    const listener = () => {
      setWindowWidth(window.innerWidth);
      if (windowWidth !== window.innerWidth) {
        updateSize();
      }
    };
    window.addEventListener("resize", listener);
    return () => window.removeEventListener("resize", listener);
  }, [updateSize, windowWidth]);

  if (currentValue === null || config === null) {
    return null;
  }

  const search = (searchString: string) => {
    const client = Client.buildClient({
      apiVersion: "2023-01",
      domain: config.apiDomain,
      storefrontAccessToken: config.storeFrontAccessToken,
    });

    return client.product.fetchQuery({
      first: 10,
      sortKey: "RELEVANCE",
      query: `title:${searchString}*`,
    })
      .then(r =>
        setSearchResults(r.map(p => ({
          id: p.id.toString(),
          title: p.title,
          handle: (p as ShopifyProduct & { handle: string }).handle,
          previewUrl: p.images[0]?.src,
          sku: (p.variants[0] as (ProductVariant & { sku?: string }) | null)?.sku,
        })))
      );
  };

  const onRemove = config.isMultiSelect ? (p: Product) => updateValue(currentValue.filter(v => v !== p)) : undefined;

  return (
    <>
      <SelectedProducts
        products={currentValue}
        onRemove={onRemove}
        isDisabled={isDisabled}
        onClear={() => updateValue([])}
      />
      <div className="search">
        <SearchInput
          isDisabled={isDisabled}
          onSubmit={search}
          onClear={() => setSearchResults([])}
        />
        {!!searchResults.length && (
          <div className="results">
            <h4>Search results ({searchResults.length})</h4>
            {searchResults.map(r => (
              <ProductTile
                key={r.id}
                product={r}
                onClick={() => updateValue(config.isMultiSelect ? [...currentValue, r] : [r])}
                isDisabled={isDisabled}
              />
            ))}
          </div>
        )}
      </div>
      <PoweredByLogo />
    </>
  );
};

ShopifyProductSelector.displayName = "ShopifyProductSelector";

type Config = Readonly<{
  apiDomain: string;
  storeFrontAccessToken: string;
  isMultiSelect: boolean;
}>;
